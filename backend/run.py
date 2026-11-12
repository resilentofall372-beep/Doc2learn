"""Entrypoint.

Development:  python run.py           (Werkzeug + WebSocket via simple-websocket)
Production:   gunicorn -k gthread --threads 32 -w 1 -b 0.0.0.0:5000 run:app
"""
import os

from app import create_app
from app.extensions import socketio

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print(f"Doc2Learn API listening on http://localhost:{port}  (health: /api/health)")
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=True)
