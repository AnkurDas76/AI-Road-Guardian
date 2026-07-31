"""
AI Driving Safety System - Root Entrypoint
Imports and launches modular Flask application from backend/
"""

import sys
import os

# Ensure backend directory is in python sys.path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from backend.app import app

if __name__ == "__main__":
    from backend.config import Config
    print(f"Starting AI Driving Safety System Backend on http://127.0.0.1:{Config.PORT}")
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)