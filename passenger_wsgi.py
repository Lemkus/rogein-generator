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
    venv_lib_path = os.path.join(venv_path, 'lib', 'python3.*', 'site-packages')
    import glob
    site_packages = glob.glob(venv_lib_path)
    if site_packages:
        sys.path.insert(0, site_packages[0])
    
    # Add path to project
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
    # For local testing
    app.run(host='0.0.0.0', port=5000, debug=True)