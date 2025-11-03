#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
try:
    from backend_simple import application
    print("OK: application imported successfully")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

