package com.ibrata2.ibratv;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Bridge exposed to the web app as window.IbraNative */
public class IbraNative {
    private final Activity activity;
    private final WebView webView;
    volatile String userAgent = "";
    volatile String referrer = "";
    private volatile boolean fullscreen = false;
    private File updateFile = null;

    IbraNative(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    boolean isFullscreen() { return fullscreen; }

    @JavascriptInterface public String flavor() { return BuildConfig.FLAVOR; }
    @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }

    @JavascriptInterface
    public void setHeaders(String ua, String ref) {
        userAgent = ua == null ? "" : ua;
        referrer = ref == null ? "" : ref;
    }

    @JavascriptInterface
    public void openExternal(String url) {
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) return;
        activity.runOnUiThread(() -> {
            try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {}
        });
    }

    @JavascriptInterface
    public void setFullscreen(boolean on) {
        fullscreen = on;
        activity.runOnUiThread(() -> {
            MainActivity a = (MainActivity) activity;
            if ("mobile".equals(BuildConfig.FLAVOR)) {
                a.setRequestedOrientation(on ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                a.setImmersive(on);
            }
        });
    }

    @JavascriptInterface
    public void exitApp() { activity.runOnUiThread(activity::finish); }

    /* ---------- playlist cache (files, no localStorage size limit) ---------- */
    private File cacheFile(String key) {
        File dir = new File(activity.getFilesDir(), "playlist-cache");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, sha1(key) + ".m3u");
    }

    @JavascriptInterface
    public String cacheRead(String key) {
        File f = cacheFile(key);
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            byte[] data = new byte[(int) f.length()];
            int off = 0, n;
            while (off < data.length && (n = in.read(data, off, data.length - off)) > 0) off += n;
            return new String(data, 0, off, StandardCharsets.UTF_8);
        } catch (Exception e) { return null; }
    }

    @JavascriptInterface
    public double cacheTime(String key) {
        File f = cacheFile(key);
        return f.exists() ? (double) f.lastModified() : 0;
    }

    @JavascriptInterface
    public void cacheWrite(String key, String text) {
        try (OutputStream out = new FileOutputStream(cacheFile(key))) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {}
    }

    /* ---------- in-app update: download the APK of this device's build ---------- */
    @JavascriptInterface
    public void downloadUpdate(String url, String name) {
        if (url == null || !url.startsWith("https://github.com/ibrata2/")) { done(false, "رابط تحديث غير موثوق"); return; }
        new Thread(() -> {
            try {
                File dir = new File(activity.getExternalCacheDir() != null ? activity.getExternalCacheDir() : activity.getCacheDir(), "updates");
                //noinspection ResultOfMethodCallIgnored
                dir.mkdirs();
                File out = new File(dir, "IBRATV-update.apk");
                HttpURLConnection c = IbraWebViewClient.open(url, "GET", null);
                long total = c.getContentLengthLong();
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    long got = 0, last = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        got += n;
                        long now = System.currentTimeMillis();
                        if (now - last > 200) { last = now; js("window.__ibraUpdate&&window.__ibraUpdate({got:" + got + ",total:" + total + "})"); }
                    }
                    js("window.__ibraUpdate&&window.__ibraUpdate({got:" + got + ",total:" + (total > 0 ? total : got) + "})");
                }
                updateFile = out;
                done(true, "");
            } catch (Exception e) {
                done(false, String.valueOf(e.getMessage()));
            }
        }).start();
    }

    @JavascriptInterface
    public String installUpdate() {
        if (updateFile == null || !updateFile.exists()) return "لم يتم تنزيل التحديث";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            activity.runOnUiThread(() -> {
                try {
                    activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())));
                } catch (Exception ignored) {}
            });
            return "permission";
        }
        activity.runOnUiThread(() -> {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", updateFile);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(i);
        });
        return "ok";
    }

    private void done(boolean ok, String msg) {
        js("window.__ibraUpdateDone&&window.__ibraUpdateDone(" + ok + "," + jsString(msg) + ")");
    }

    private void js(String code) {
        webView.post(() -> webView.evaluateJavascript(code, null));
    }

    private static String jsString(String s) {
        if (s == null) s = "";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ") + "\"";
    }

    private static String sha1(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest(s.getBytes(StandardCharsets.UTF_8))) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { return Integer.toHexString(s.hashCode()); }
    }
}
