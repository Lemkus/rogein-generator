#!/usr/bin/env python3
"""
Простой HTTP сервер для отладки audio-debug.html
Запускает локальный сервер на порту 8000
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Добавляем CORS заголовки для отладки
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def main():
    # Переходим в директорию скрипта
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    Handler = MyHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            url = f"http://localhost:{PORT}/audio-debug.html"
            print("=" * 60)
            print(f"🚀 HTTP сервер запущен!")
            print(f"📂 Рабочая директория: {os.getcwd()}")
            print(f"🌐 Откройте в браузере: {url}")
            print("=" * 60)
            print("\nНажмите Ctrl+C для остановки сервера\n")
            
            # Автоматически открываем браузер
            try:
                webbrowser.open(url)
            except:
                pass
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Сервер остановлен")
        sys.exit(0)
    except OSError as e:
        if e.errno == 10048:  # Windows: порт уже занят
            print(f"❌ Ошибка: Порт {PORT} уже занят!")
            print(f"   Закройте другое приложение или измените PORT в скрипте")
        else:
            print(f"❌ Ошибка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

