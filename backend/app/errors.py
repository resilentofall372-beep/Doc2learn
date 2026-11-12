"""Uniform JSON error responses."""
from __future__ import annotations

import logging

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

log = logging.getLogger(__name__)


class ApiError(Exception):
    """Raise anywhere in a request to return a JSON error with a status code."""

    def __init__(self, message: str, status: int = 400, **extra):
        super().__init__(message)
        self.message = message
        self.status = status
        self.extra = extra


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def handle_api_error(err: ApiError):
        payload = {"success": False, "error": err.message, **err.extra}
        return jsonify(payload), err.status

    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        return jsonify({"success": False, "error": err.description}), err.code

    @app.errorhandler(Exception)
    def handle_unexpected(err: Exception):
        log.exception("Unhandled error")
        return jsonify({"success": False, "error": "Internal server error"}), 500
