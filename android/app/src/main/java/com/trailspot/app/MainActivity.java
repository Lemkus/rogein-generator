package com.trailspot.app;

import android.content.Intent;
import android.net.Uri;
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

    /**
     * Срабатывает когда приложение уже запущено и пользователь открывает
     * https://trailspot.app/r/<id> — Android доставляет URL через onNewIntent.
     */
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        deliverDeepLink(intent);
    }

    /**
     * Срабатывает при первом запуске через ссылку (cold start).
     */
    @Override
    public void onStart() {
        super.onStart();
        deliverDeepLink(getIntent());
    }

    private void deliverDeepLink(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;

        String url = data.toString();
        // Экранируем кавычки и слэши для безопасной передачи в JS
        String escaped = url.replace("\\", "\\\\").replace("\"", "\\\"");
        String js =
            "window.__trailspotDeepLink = \"" + escaped + "\";" +
            "window.dispatchEvent(new CustomEvent('trailspotDeepLink', { detail: \"" + escaped + "\" }));";

        getBridge().getWebView().post(() ->
            getBridge().getWebView().evaluateJavascript(js, null)
        );
    }
}
