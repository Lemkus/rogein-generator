#!/usr/bin/env python3
"""
WSGI file for Flask application on REG.RU Passenger
Simplified version for debugging
"""

import sys
import os

# Add path to virtual environment
project_path = os.path.dirname(os.path.abspath(__file__))
venv_path = os.path.join(project_path, 'venv')

# Add path to virtual environment libraries
if os.path.exists(venv_path):
    # Try different Python versions
    for python_version in ['python3.8', 'python3.9', 'python3.10', 'python3']:
        venv_lib_path = os.path.join(venv_path, 'lib', python_version, 'site-packages')
        if os.path.exists(venv_lib_path):
            sys.path.insert(0, venv_lib_path)
            print(f"Added venv site-packages: {venv_lib_path}")
            break
    else:
        print(f"Venv site-packages not found in venv: {venv_path}")
    
    # Add path to project
    if project_path not in sys.path:
        sys.path.insert(0, project_path)
        print(f"Added project path: {project_path}")
else:
    print(f"Virtual environment not found at: {venv_path}")
    # Add project path anyway
    if project_path not in sys.path:
        sys.path.insert(0, project_path)

# Import Flask application
try:
    from backend_simple import application
    print("Flask application imported successfully")
    print(f"Application type: {type(application)}")
except ImportError as e:
    print(f"Import Error: {e}")
    import traceback
    traceback.print_exc()
    # Try to import app and create application
    try:
        from backend_simple import app
        application = app
        print("Using app as application")
    except Exception as e2:
        print(f"Error importing app: {e2}")
        traceback.print_exc()
        # Create simple application for debugging
        try:
            from flask import Flask
            app = Flask(__name__)
            
            @app.route('/')
            def hello():
                return f'<h1>Import Error: {e}</h1><p>Error2: {e2}</p><pre>{traceback.format_exc()}</pre>'
            
            application = app
        except Exception as e3:
            print(f"Error creating Flask app: {e3}")
            traceback.print_exc()
            # Last resort - create minimal WSGI app
            def application(environ, start_response):
                status = '200 OK'
                headers = [('Content-type', 'text/html; charset=utf-8')]
                start_response(status, headers)
                return [f'<h1>Error</h1><p>{e}</p><p>{e2}</p><p>{e3}</p>'.encode('utf-8')]
except Exception as e:
    print(f"Error importing Flask application: {e}")
    import traceback
    traceback.print_exc()
    # Create simple application for debugging
    try:
        from flask import Flask
        app = Flask(__name__)
        
        @app.route('/')
        def hello():
            return f'<h1>Import Error: {e}</h1><p>Check virtual environment and dependencies</p><pre>{traceback.format_exc()}</pre>'
        
        application = app
    except Exception as e2:
        print(f"Error creating Flask app: {e2}")
        traceback.print_exc()
        # Last resort - create minimal WSGI app
        def application(environ, start_response):
            status = '200 OK'
            headers = [('Content-type', 'text/html; charset=utf-8')]
            start_response(status, headers)
            return [f'<h1>Error</h1><p>{e}</p><p>{e2}</p>'.encode('utf-8')]

if __name__ == "__main__":
    # For local testing only - Passenger ignores this
    pass
