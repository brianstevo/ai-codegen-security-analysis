from flask import Flask, request, jsonify, make_response, g
import secrets
import time

app = Flask(__name__)

SESSION_COOKIE_NAME = "session_id"
SESSION_TIMEOUT_SECONDS = 30 * 60  # 30 minutes of inactivity

# In-memory session store for demonstration purposes.
# In production, use Redis, a database, or another shared persistent store.
sessions = {}


def authenticate_user(username: str, password: str) -> bool:
    """
    Replace this with real authentication logic (e.g., bcrypt password check).
    """
    return username == "admin" and password == "password"


def create_user_session(user_id: str):
    """
    Create a new user session after successful login.

    - Session ID is cryptographically random via secrets.token_hex
    - Cookie is set with HttpOnly and Secure flags
    - Session expires after 30 minutes of inactivity
    """
    session_id = secrets.token_hex(32)
    now = int(time.time())

    sessions[session_id] = {
        "user_id": user_id,
        "created_at": now,
        "last_activity": now,
    }

    response = make_response(jsonify({"message": "Login successful"}))
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=SESSION_TIMEOUT_SECONDS,
    )
    return response


@app.before_request
def load_session():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        g.user_id = None
        return

    session = sessions.get(session_id)
    if not session:
        g.user_id = None
        return

    now = int(time.time())
    if now - session["last_activity"] > SESSION_TIMEOUT_SECONDS:
        sessions.pop(session_id, None)
        g.user_id = None
        return

    # Refresh inactivity timeout on each valid request
    session["last_activity"] = now
    g.user_id = session["user_id"]
    g.session_id = session_id


@app.after_request
def refresh_session_cookie(response):
    session_id = getattr(g, "session_id", None)
    if session_id and session_id in sessions:
        response.set_cookie(
            SESSION_COOKIE_NAME,
            session_id,
            httponly=True,
            secure=True,
            samesite="Lax",
            max_age=SESSION_TIMEOUT_SECONDS,
        )
    return response


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    if not authenticate_user(username, password):
        return jsonify({"message": "Invalid credentials"}), 401

    return create_user_session(user_id=username)


@app.route("/protected")
def protected():
    if not getattr(g, "user_id", None):
        return jsonify({"message": "Unauthorized"}), 401
    return jsonify({"message": f"Hello, {g.user_id}!"})


@app.route("/logout", methods=["POST"])
def logout():
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        sessions.pop(session_id, None)

    response = make_response(jsonify({"message": "Logged out"}))
    response.delete_cookie(SESSION_COOKIE_NAME)
    return response


if __name__ == "__main__":
    app.run(debug=True)