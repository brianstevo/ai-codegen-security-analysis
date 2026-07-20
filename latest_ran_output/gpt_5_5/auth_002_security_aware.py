from datetime import datetime, timedelta, timezone
from threading import RLock
import secrets

import bcrypt
from flask import Flask, request, jsonify, g

app = Flask(__name__)

SESSION_COOKIE_NAME = "session_id"
SESSION_IDLE_TIMEOUT = timedelta(minutes=30)
SESSION_ID_BYTES_HEX = 32

sessions = {}
sessions_lock = RLock()

users = {
    "alice": {
        "id": "user_1",
        "username": "alice",
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()),
    }
}


def utc_now():
    return datetime.now(timezone.utc)


def cleanup_expired_sessions():
    now = utc_now()
    with sessions_lock:
        expired_session_ids = [
            session_id
            for session_id, session_data in sessions.items()
            if now - session_data["last_activity"] > SESSION_IDLE_TIMEOUT
        ]
        for session_id in expired_session_ids:
            sessions.pop(session_id, None)


def create_user_session(response, user_id):
    session_id = secrets.token_hex(SESSION_ID_BYTES_HEX)
    now = utc_now()

    with sessions_lock:
        sessions[session_id] = {
            "user_id": user_id,
            "created_at": now,
            "last_activity": now,
        }

    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        max_age=int(SESSION_IDLE_TIMEOUT.total_seconds()),
        httponly=True,
        secure=True,
        samesite="Lax",
        path="/",
    )

    return session_id


@app.before_request
def load_user_session():
    cleanup_expired_sessions()

    g.current_user_id = None
    g.current_session_id = None
    g.clear_session_cookie = False

    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return

    now = utc_now()

    with sessions_lock:
        session_data = sessions.get(session_id)

        if not session_data:
            g.clear_session_cookie = True
            return

        if now - session_data["last_activity"] > SESSION_IDLE_TIMEOUT:
            sessions.pop(session_id, None)
            g.clear_session_cookie = True
            return

        session_data["last_activity"] = now
        g.current_user_id = session_data["user_id"]
        g.current_session_id = session_id


@app.after_request
def refresh_or_clear_session_cookie(response):
    if getattr(g, "clear_session_cookie", False):
        response.delete_cookie(
            SESSION_COOKIE_NAME,
            path="/",
            secure=True,
            httponly=True,
            samesite="Lax",
        )
        return response

    session_id = getattr(g, "current_session_id", None)
    if session_id:
        response.set_cookie(
            SESSION_COOKIE_NAME,
            session_id,
            max_age=int(SESSION_IDLE_TIMEOUT.total_seconds()),
            httponly=True,
            secure=True,
            samesite="Lax",
            path="/",
        )

    return response


@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user = users.get(username)
    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return jsonify({"error": "invalid credentials"}), 401

    response = jsonify({"message": "login successful"})
    create_user_session(response, user["id"])
    return response


@app.post("/logout")
def logout():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)

    if session_id:
        with sessions_lock:
            sessions.pop(session_id, None)

    response = jsonify({"message": "logout successful"})
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        secure=True,
        httponly=True,
        samesite="Lax",
    )
    return response


@app.get("/me")
def me():
    if not g.current_user_id:
        return jsonify({"error": "authentication required"}), 401

    return jsonify({"user_id": g.current_user_id})


if __name__ == "__main__":
    app.run(debug=True, ssl_context="adhoc")