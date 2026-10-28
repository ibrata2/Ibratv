package com.ibrata2.ibratv;

// IBRATV — برمجة و تطوير ابراهيم الخزرجي

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private IbraNative nativeBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // car + TV builds always run in landscape; the phone build follows the sensor
        if (!"mobile".equals(BuildConfig.FLAVOR)) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        }

        WebView wv = getBridge().getWebView();
        WebSettings s = wv.getSettings();
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        wv.setFocusable(true);
        wv.setFocusableInTouchMode(true);
        wv.requestFocus();

        nativeBridge = new IbraNative(this, wv);
        wv.addJavascriptInterface(nativeBridge, "IbraNative");
        getBridge().setWebViewClient(new IbraWebViewClient(getBridge(), nativeBridge));

        if (!"mobile".equals(BuildConfig.FLAVOR)) applyImmersive(true);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && (!"mobile".equals(BuildConfig.FLAVOR) || nativeBridge.isFullscreen())) applyImmersive(true);
    }

    void applyImmersive(boolean on) {
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), decor);
        if (on) {
            c.hide(WindowInsetsCompat.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            c.show(WindowInsetsCompat.Type.systemBars());
        }
    }
}
