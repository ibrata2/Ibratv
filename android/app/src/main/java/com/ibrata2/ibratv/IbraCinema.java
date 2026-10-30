package com.ibrata2.ibratv;

// IBRATV — السينما (native WebView overlay with ad & popup blocking)
// برمجة و تطوير ابراهيم الخزرجي

import android.annotation.SuppressLint;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Message;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public class IbraCinema {
    private final MainActivity activity;
    private final WebView appView;           // the Capacitor WebView (our UI)
    private WebView web;                     // the site
    private View customView;                 // HTML5 fullscreen video
    private WebChromeClient.CustomViewCallback customCallback;
    private final Set<String> adHosts = new HashSet<>();
    private volatile boolean canBack = false;
    private volatile boolean loading = false;
    private volatile int blocked = 0;
    private int lastOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;

    static final String AD_CSS =
        "ins.adsbygoogle,[id^='google_ads'],[id^='div-gpt-ad'],iframe[src*='doubleclick'],iframe[src*='googlesyndication']," +
        "iframe[src*='/ads/'],iframe[id*='ads'],a[href*='doubleclick.net'],[class*='popunder'],[id*='popunder']," +
        "[class^='adsbox'],[class*='ad-banner'],[id*='ad-banner'],[class*='adsbanner'],[class*='advertis'],[id*='advertis']," +
        "div[class*='sponsor-ad'],div[id^='ad_'],div[class^='ad_'],div[id^='ads_'],div[class^='ads_'],.adsense,.adslot,.ad-slot," +
        "div[data-ad-slot],div[data-adunit],amp-ad,amp-embed,[class*='banner-ads'],[id*='banner-ads']{display:none!important}";
    // runs at document start: neutralise pop-up openers and hide common ad boxes
    static final String SHIELD_JS =
        "(function(){try{if(window.__ibraShield)return;window.__ibraShield=1;" +
        "var o=window.open;window.open=function(){return null};" +
        "var st=document.createElement('style');st.textContent=\"" + AD_CSS.replace("'", "\\'") + "\";" +
        "(document.head||document.documentElement).appendChild(st);" +
        "document.addEventListener('DOMContentLoaded',function(){(document.head||document.documentElement).appendChild(st)});" +
        "}catch(e){}})();";

    IbraCinema(MainActivity activity, WebView appView) {
        this.activity = activity;
        this.appView = appView;
        try (BufferedReader r = new BufferedReader(new InputStreamReader(activity.getAssets().open("public/adblock-hosts.txt"), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                line = line.trim().toLowerCase(Locale.ROOT);
                if (!line.isEmpty() && !line.startsWith("#")) adHosts.add(line);
            }
        } catch (Exception ignored) {}
    }

    boolean isAd(String host) {
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        while (!host.isEmpty()) {
            if (adHosts.contains(host)) return true;
            int i = host.indexOf('.');
            if (i < 0) break;
            host = host.substring(i + 1);
        }
        return false;
    }

    private static String site(String host) {
        if (host == null) return "";
        String[] p = host.split("\\.");
        return p.length < 2 ? host : p[p.length - 2] + "." + p[p.length - 1];
    }

    /* ---------------- JS API (window.IbraCinema) ---------------- */
    @JavascriptInterface
    public void open(String url, double x, double y, double w, double h) {
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) return;
        activity.runOnUiThread(() -> {
            ensureView();
            place(x, y, w, h);
            web.setVisibility(View.VISIBLE);
            blocked = 0;
            web.clearHistory();
            web.loadUrl(url);
            web.requestFocus();
        });
    }

    @JavascriptInterface
    public void setBounds(double x, double y, double w, double h) {
        activity.runOnUiThread(() -> { if (web != null) place(x, y, w, h); });
    }

    @JavascriptInterface
    public void setVisible(boolean v) {
        activity.runOnUiThread(() -> {
            if (web == null) return;
            web.setVisibility(v && customView == null ? View.VISIBLE : View.INVISIBLE);
            if (v) web.requestFocus(); else appView.requestFocus();
        });
    }

    /** returns true when it handled the back press (exit fullscreen / page back) */
    @JavascriptInterface
    public boolean back() {
        if (customView != null) { activity.runOnUiThread(this::hideCustomView); return true; }
        if (web != null && canBack) { activity.runOnUiThread(() -> { if (web != null) web.goBack(); }); return true; }
        return false;
    }

    @JavascriptInterface public void forward() { activity.runOnUiThread(() -> { if (web != null && web.canGoForward()) web.goForward(); }); }
    @JavascriptInterface public void reload() { activity.runOnUiThread(() -> { if (web != null) web.reload(); }); }

    @JavascriptInterface
    public void close() {
        activity.runOnUiThread(() -> {
            hideCustomView();
            if (web != null) {
                web.stopLoading();
                web.loadUrl("about:blank");
                ((ViewGroup) web.getParent()).removeView(web);
                web.destroy();
                web = null;
            }
            canBack = false;
            appView.requestFocus();
        });
    }

    /* ---------------- internals ---------------- */
    private FrameLayout root() { return activity.findViewById(android.R.id.content); }

    private void place(double x, double y, double w, double h) {
        float d = activity.getResources().getDisplayMetrics().density;
        int[] a = new int[2], b = new int[2];
        appView.getLocationInWindow(a);
        root().getLocationInWindow(b);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Math.max(1, Math.round((float) w * d)), Math.max(1, Math.round((float) h * d)));
        lp.gravity = Gravity.TOP | Gravity.LEFT;
        lp.leftMargin = a[0] - b[0] + Math.round((float) x * d);
        lp.topMargin = a[1] - b[1] + Math.round((float) y * d);
        web.setLayoutParams(lp);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void ensureView() {
        if (web != null) return;
        web = new WebView(activity);
        web.setBackgroundColor(Color.WHITE);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setSupportMultipleWindows(true);            // so pop-ups reach onCreateWindow (and get blocked)
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        // look like a normal mobile browser (some sites refuse WebViews)
        s.setUserAgentString(s.getUserAgentString().replace("; wv", "").replaceAll("Version/\\d+\\.\\d+ ", ""));
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try { WebViewCompat.addDocumentStartJavaScript(web, SHIELD_JS, Collections.singleton("*")); } catch (Exception ignored) {}
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                if (isAd(req.getUrl().getHost())) {
                    blocked++;
                    return new WebResourceResponse("text/plain", "utf-8", 204, "Blocked", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
                }
                return null;
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String sc = u.getScheme() == null ? "" : u.getScheme();
                if (isAd(u.getHost())) { blocked++; emit(); return true; }
                if (!sc.equals("http") && !sc.equals("https")) return true;   // intent://, market:// … stay inside
                return false;
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) { loading = true; emit(); }
            @Override public void onPageFinished(WebView view, String url) {
                loading = false;
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) view.evaluateJavascript(SHIELD_JS, null);
                emit();
            }
            @Override public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) { emit(); }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // a same-site link opened in a new tab loads in place; everything else is a pop-up → blocked
                WebView.HitTestResult hit = view.getHitTestResult();
                String target = hit != null ? hit.getExtra() : null;
                if (isUserGesture && target != null) {
                    String th = Uri.parse(target).getHost(), ch = Uri.parse(String.valueOf(view.getUrl())).getHost();
                    if (th != null && site(th).equals(site(ch)) && !isAd(th)) { view.loadUrl(target); return false; }
                }
                blocked++; emit();
                return false;
            }
            @Override public void onShowCustomView(View v, CustomViewCallback cb) { showCustomView(v, cb); }
            @Override public void onHideCustomView() { hideCustomView(); }
            @Override public void onProgressChanged(WebView view, int p) { if (p == 100) emit(); }
        });

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(1, 1);
        lp.gravity = Gravity.TOP | Gravity.LEFT;
        root().addView(web, lp);
    }

    private void showCustomView(View v, WebChromeClient.CustomViewCallback cb) {
        if (customView != null) { cb.onCustomViewHidden(); return; }
        customView = v;
        customCallback = cb;
        v.setBackgroundColor(Color.BLACK);
        root().addView(v, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (web != null) web.setVisibility(View.INVISIBLE);
        lastOrientation = activity.getRequestedOrientation();
        if ("mobile".equals(BuildConfig.FLAVOR)) activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        activity.applyImmersive(true);
    }

    private void hideCustomView() {
        if (customView == null) return;
        root().removeView(customView);
        customView = null;
        if (customCallback != null) customCallback.onCustomViewHidden();
        customCallback = null;
        if (web != null) web.setVisibility(View.VISIBLE);
        activity.setRequestedOrientation(lastOrientation);
        if ("mobile".equals(BuildConfig.FLAVOR)) activity.applyImmersive(false);
    }

    private void emit() {
        if (web == null) return;
        canBack = web.canGoBack();
        String js = "window.__ibraCinema&&window.__ibraCinema({loading:" + loading + ",canBack:" + canBack + ",blocked:" + blocked + "})";
        appView.post(() -> appView.evaluateJavascript(js, null));
    }
}
