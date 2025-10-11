import sys
import os
INTERP = os.path.expanduser("/var/www/u3288673/data/venv/bin/python")
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)
sys.path.append(os.getcwd())
from hello import application
