#!/usr/bin/env python3
"""
HTTP server for Audio Navigation Simulator
Launches a local server and opens the simulator page for testing navigation sounds
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import time

PORT = 8081

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for audio modules
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Prevent caching for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Custom log format with timestamp
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] {format % args}")

def print_banner():
    """Print a nice banner for the simulator"""
    banner = """
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║       🎮 Audio Navigation Simulator Server 🎮           ║
    ║                                                          ║
    ║          Test navigation sounds interactively!          ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
    """
    print(banner)

def main():
    # Change to the script's directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print_banner()
    
    Handler = MyHTTPRequestHandler
    
    # Use local variable for port
    port = PORT
    
    # Check if port is available
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    port_available = sock.connect_ex(('localhost', port)) != 0
    sock.close()
    
    if not port_available:
        print(f"⚠️  Port {port} is already in use!")
        print("   Trying alternative ports...")
        
        # Try alternative ports
        for alt_port in [8001, 8080, 8888, 3000]:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            if sock.connect_ex(('localhost', alt_port)) != 0:
                port = alt_port
                print(f"✅ Using port {port} instead")
                break
            sock.close()
        else:
            print("❌ No available ports found. Please close other servers.")
            sys.exit(1)
    
    try:
        with socketserver.TCPServer(("", port), Handler) as httpd:
            # Allow socket reuse
            httpd.allow_reuse_address = True
            
            url = f"http://localhost:{port}/audio-navigation-simulator.html"
            
            print("=" * 60)
            print(f"🚀 Server successfully started!")
            print(f"📂 Working directory: {os.getcwd()}")
            print(f"🌐 Simulator URL: {url}")
            print("=" * 60)
            print("\n📋 Quick Guide:")
            print("  • Use Arrow Keys or WASD to move the player")
            print("  • Click on canvas to teleport")
            print("  • Navigate to yellow targets in order")
            print("  • Audio feedback helps guide you to targets")
            print("  • Press Space to test sound at current distance")
            print("\n🛠️ Available Pages:")
            print(f"  • Simulator: http://localhost:{port}/audio-navigation-simulator.html")
            print(f"  • Debug: http://localhost:{port}/audio-debug.html")
            print(f"  • Improved: http://localhost:{port}/improved-sounds-test.html")
            print("\n⏹️ Press Ctrl+C to stop the server\n")
            print("=" * 60)
            print("\n📊 Server Log:")
            
            # Automatically open browser after a short delay
            def open_browser():
                time.sleep(1)
                try:
                    webbrowser.open(url)
                    print(f"\n✅ Browser opened to: {url}")
                except:
                    print(f"\n⚠️  Could not open browser automatically")
                    print(f"   Please open manually: {url}")
            
            # Open browser in a separate thread to not block the server
            import threading
            browser_thread = threading.Thread(target=open_browser)
            browser_thread.daemon = True
            browser_thread.start()
            
            # Start serving
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("🛑 Server stopped by user")
        print("=" * 60)
        sys.exit(0)
        
    except OSError as e:
        if e.errno == 10048:  # Windows: Address already in use
            print(f"\n❌ Error: Port {port} is already in use!")
            print("   Please close other applications using this port")
            print("   or modify the PORT variable in this script")
        elif e.errno == 98:  # Linux: Address already in use
            print(f"\n❌ Error: Port {port} is already in use!")
            print(f"   Wait a moment or use: lsof -ti:{port} | xargs kill -9")
        else:
            print(f"\n❌ Error: {e}")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
