package com.trailspot.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onResume() {
        super.onResume();
        // Уведомляем WebView что приложение вернулось на передний план,
        // чтобы AudioContext мог возобновить воспроизведение после разблокировки.
        getBridge().getWebView().post(() ->
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('capacitorResume'))", null
            )
        );
    }
}

