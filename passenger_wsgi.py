#!/usr/bin/env python3
"""
WSGI file for Flask application on REG.RU Passenger
Minimal version with detailed error reporting
"""

import sys
import os
import traceback

# Debug: Print environment info
def debug_info():
    info = []
    info.append(f"Python version: {sys.version}")
    info.append(f"Python executable: {sys.executable}")
    info.append(f"Current directory: {os.getcwd()}")
    info.append(f"Script path: {__file__}")
    return "\n".join(info)

# Add path to virtual environment
project_path = os.path.dirname(os.path.abspath(__file__))
venv_path = os.path.join(project_path, 'venv')

print("=== Passenger WSGI Startup ===")
print(debug_info())
print(f"Project path: {project_path}")
print(f"Venv path: {venv_path}")
print(f"Venv exists: {os.path.exists(venv_path)}")

# Add path to virtual environment libraries
if os.path.exists(venv_path):
    # Try different Python versions
    found_venv = False
    for python_version in ['python3.8', 'python3.9', 'python3.10', 'python3.11', 'python3']:
        venv_lib_path = os.path.join(venv_path, 'lib', python_version, 'site-packages')
        if os.path.exists(venv_lib_path):
            sys.path.insert(0, venv_lib_path)
            print(f"✅ Added venv site-packages: {venv_lib_path}")
            found_venv = True
            break
    
    if not found_venv:
        print(f"⚠️ Venv site-packages not found. Checking venv structure...")
        if os.path.exists(venv_path):
            lib_path = os.path.join(venv_path, 'lib')
            if os.path.exists(lib_path):
                print(f"   Lib directory exists, contents: {os.listdir(lib_path)}")
    
    # Add path to project
    if project_path not in sys.path:
        sys.path.insert(0, project_path)
        print(f"✅ Added project path: {project_path}")
else:
    print(f"⚠️ Virtual environment not found at: {venv_path}")
    # Add path to project anyway
    if project_path not in sys.path:
        sys.path.insert(0, project_path)
        print(f"✅ Added project path: {project_path}")

print(f"Python path: {sys.path}")

# Import Flask application
try:
    print("Attempting to import backend_simple.application...")
    from backend_simple import application
    print("✅ Flask application imported successfully")
    print(f"Application type: {type(application)}")
except ImportError as e:
    print(f"❌ Import Error: {e}")
    traceback.print_exc()
    # Try to import app and create application
    try:
        print("Attempting to import backend_simple.app...")
        from backend_simple import app
        application = app
        print("✅ Using app as application")
    except Exception as e2:
        print(f"❌ Error importing app: {e2}")
        traceback.print_exc()
        # Create simple application for debugging
        try:
            print("Attempting to import Flask...")
            from flask import Flask
            app = Flask(__name__)
            
            @app.route('/')
            def hello():
                error_msg = f"""
                <h1>Import Error</h1>
                <h2>Error 1 (application):</h2>
                <pre>{e}</pre>
                <h2>Error 2 (app):</h2>
                <pre>{e2}</pre>
                <h2>Traceback:</h2>
                <pre>{traceback.format_exc()}</pre>
                <h2>Debug Info:</h2>
                <pre>{debug_info()}</pre>
                <h2>Python Path:</h2>
                <pre>{chr(10).join(sys.path)}</pre>
                """
                return error_msg
            
            application = app
            print("✅ Created Flask app with error handler")
        except Exception as e3:
            print(f"❌ Error creating Flask app: {e3}")
            traceback.print_exc()
            # Last resort - create minimal WSGI app
            def application(environ, start_response):
                status = '200 OK'
                headers = [('Content-type', 'text/html; charset=utf-8')]
                start_response(status, headers)
                error_html = f"""
                <h1>Critical Error</h1>
                <p>Error 1: {e}</p>
                <p>Error 2: {e2}</p>
                <p>Error 3: {e3}</p>
                <pre>{traceback.format_exc()}</pre>
                <pre>{debug_info()}</pre>
                """
                return [error_html.encode('utf-8')]
except Exception as e:
    print(f"❌ Error importing Flask application: {e}")
    traceback.print_exc()
    # Create simple application for debugging
    try:
        from flask import Flask
        app = Flask(__name__)
        
        @app.route('/')
        def hello():
            return f"""
            <h1>Import Error</h1>
            <p>Error: {e}</p>
            <pre>{traceback.format_exc()}</pre>
            <pre>{debug_info()}</pre>
            <pre>Python path: {chr(10).join(sys.path)}</pre>
            """
        
        application = app
        print("✅ Created Flask app with error handler")
    except Exception as e2:
        print(f"❌ Error creating Flask app: {e2}")
        traceback.print_exc()
        # Last resort - create minimal WSGI app
        def application(environ, start_response):
            status = '200 OK'
            headers = [('Content-type', 'text/html; charset=utf-8')]
            start_response(status, headers)
            error_html = f"""
            <h1>Critical Error</h1>
            <p>Error: {e}</p>
            <p>Error 2: {e2}</p>
            <pre>{traceback.format_exc()}</pre>
            <pre>{debug_info()}</pre>
            """
            return [error_html.encode('utf-8')]

print("=== Passenger WSGI Ready ===")

if __name__ == "__main__":
    # For local testing only - Passenger ignores this
    pass
