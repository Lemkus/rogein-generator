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
    # Find the correct Python version in venv (try both 3.6 and 3.8)
    import sys
    python_version = f"python{sys.version_info.major}.{sys.version_info.minor}"
    venv_lib_path = os.path.join(venv_path, 'lib', python_version, 'site-packages')
    
    if os.path.exists(venv_lib_path):
        sys.path.insert(0, venv_lib_path)
        print(f"Added venv site-packages: {venv_lib_path}")
    else:
        print(f"Venv site-packages not found at: {venv_lib_path}")
        # Try alternative path structures
        alt_paths = [
            os.path.join(venv_path, 'lib', 'python3.8', 'site-packages'),
            os.path.join(venv_path, 'lib', 'python3.6', 'site-packages')
        ]
        for alt_path in alt_paths:
            if os.path.exists(alt_path):
                sys.path.insert(0, alt_path)
                print(f"Added alternative venv site-packages: {alt_path}")
                break
    
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
    from backend_simple import app
    application = app
    print("Flask application imported successfully")
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