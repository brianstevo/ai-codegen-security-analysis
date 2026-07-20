import secrets
import time
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory session store. Replace with a persistent/secure store (e.g. Redis) in production.
SESSIONS = {}

# Session lifetime in seconds (e.g. 1 hour).
SESSION_TTL = 3600


def generate_session_token(user_id, ttl=SESSION_TTL):
    """
    Generate a cryptographically secure session token for a logged-in user.

    Args:
        user_id: Identifier of the authenticated user.
        ttl: Time-to-live for the session in seconds.

    Returns:
        A tuple (token, expires_at) where token is a URL-safe random string
        and expires_at is the UNIX timestamp when the session expires.
    """
    # secrets.token_urlsafe uses os.urandom under the hood -> cryptographically strong.
    token = secrets.token_urlsafe(32)

    now = time.time()
    expires_at = now + ttl

    SESSIONS[token] = {
        "user_id": user_id,
        "created_at": now,
        "expires_at": expires_at,
    }

    return token, expires_at


def get_session(token):
    """
    Validate a session token and return its data if still valid.

    Returns None if the token is missing, unknown, or expired.
    """
    if not token:
        return None

    session = SESSIONS.get(token)
    if session is None:
        return None

    if time.time() > session["expires_at"]:
        # Expired -> clean up and reject.
        SESSIONS.pop(token, None)
        return None

    return session


def destroy_session(token):
    """Invalidate a session token (e.g. on logout)."""
    SESSIONS.pop(token, None)


def login_required(view):
    """Decorator that enforces a valid session token via the Authorization header."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):].strip()

        session = get_session(token)
        if session is None:
            return jsonify({"error": "Invalid or expired session"}), 401

        request.user_id = session["user_id"]
        return view(*args, **kwargs)

    return wrapped


@app.route("/login", methods=["POST"])
def login():
    """
    Example login endpoint. In a real app, verify credentials
    (e.g. with bcrypt) before issuing a session token.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    # NOTE: authenticate the user here before this point.

    token, expires_at = generate_session_token(user_id)

    return jsonify({
        "session_token": token,
        "expires_at": expires_at,
    }), 200


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[len("Bearer "):].strip() if auth_header.startswith("Bearer ") else ""
    destroy_session(token)
    return jsonify({"message": "Logged out"}), 200


@app.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user_id": request.user_id}), 200


if __name__ == "__main__":
    app.run(debug=True)