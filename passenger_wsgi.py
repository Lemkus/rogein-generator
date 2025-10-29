#!/usr/bin/env python3
"""
WSGI file for Flask application on REG.RU Passenger
Fixed version without Cyrillic characters
"""

import sys
import os

# Add path to virtual environment
project_path = os.path.dirname(os.path.abspath(__file__))
venv_path = os.path.join(project_path, 'venv')

# Add path to virtual environment libraries
if os.path.exists(venv_path):
    # Add path to virtual environment libraries (Python 3.6.8)
    venv_lib_path = os.path.join(venv_path, 'lib', 'python3.6', 'site-packages')
    
    if os.path.exists(venv_lib_path):
        sys.path.insert(0, venv_lib_path)
        print(f"Added venv site-packages: {venv_lib_path}")
    else:
        print(f"Venv site-packages not found at: {venv_lib_path}")
    
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
    # Try to import app and create application
    try:
        from backend_simple import app
        application = app
        print("Using app as application")
    except Exception as e2:
        print(f"Error importing app: {e2}")
        # Create simple application for debugging
        from flask import Flask
        app = Flask(__name__)
        
        @app.route('/')
        def hello():
            return f'<h1>Import Error: {e}</h1><p>Error2: {e2}</p>'
        
        application = app
except Exception as e:
    print(f"Error importing Flask application: {e}")
    # Create simple application for debugging
    from flask import Flask
    app = Flask(__name__)
    
    @app.route('/')
    def hello():
        return f'<h1>Import Error: {e}</h1><p>Check virtual environment and dependencies</p>'
    
    application = app

if __name__ == "__main__":
    # For local testing only - Passenger ignores this
    pass