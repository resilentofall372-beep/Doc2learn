"""Doc2Learn backend application factory."""
from __future__ import annotations

import logging

from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config
from .extensions import init_db, socketio


def create_app(config: type[Config] | None = None, db=None) -> Flask:
    """Build the Flask app.

    `db` lets tests inject an in-memory database instead of a live Mongo.
    """
    app = Flask(__name__)
    app.config.from_object(config or Config)

    logging.basicConfig(
        level=app.config["LOG_LEVEL"],
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    CORS(
        app,
        origins=app.config["CORS_ORIGINS"],
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
    )

    init_db(app, db)
    socketio.init_app(
        app,
        cors_allowed_origins=app.config["CORS_ORIGINS"],
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    from .routes.auth import bp as auth_bp
    from .routes.projects import bp as projects_bp
    from .routes.documents import bp as documents_bp
    from .routes.quiz import bp as quiz_bp
    from .routes.flashcards import bp as flashcards_bp
    from .routes.mindmap import bp as mindmap_bp
    from .routes.assistant import bp as assistant_bp
    from .routes.rooms import bp as rooms_bp
    from .routes.stats import bp as stats_bp
    from . import sockets

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(projects_bp, url_prefix="/api/projects")
    app.register_blueprint(documents_bp, url_prefix="/api/document")
    app.register_blueprint(quiz_bp, url_prefix="/api/quiz")
    app.register_blueprint(flashcards_bp, url_prefix="/api/flashcards")
    app.register_blueprint(mindmap_bp, url_prefix="/api/mindmap")
    app.register_blueprint(assistant_bp, url_prefix="/api/assistant")
    app.register_blueprint(rooms_bp, url_prefix="/api/room")
    app.register_blueprint(stats_bp, url_prefix="/api/stats")
    sockets.register(socketio)

    from .errors import register_error_handlers

    register_error_handlers(app)

    @app.get("/api/health")
    def health():
        from .extensions import db_ping
        from .services.llm import llm_status

        return jsonify(
            {
                "status": "ok",
                "database": db_ping(),
                "llm": llm_status(),
                "public_url": app.config["PUBLIC_URL"] or None,
            }
        )

    return app
