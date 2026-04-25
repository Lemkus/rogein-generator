package com.trailspot.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    /**
     * onResume вызывается когда приложение возвращается на передний план
     * (разблокировка экрана, переключение обратно из другого приложения).
     * Мы уведомляем WebView чтобы AudioContext мог возобновить воспроизведение.
     */
    @Override
    protected void onResume() {
        super.onResume();
        getBridge().getWebView().post(() ->
            getBridge().eval("window.dispatchEvent(new Event('capacitorResume'))", result -> {})
        );
    }
}
