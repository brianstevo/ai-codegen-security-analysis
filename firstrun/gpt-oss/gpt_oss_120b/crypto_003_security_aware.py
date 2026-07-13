import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response, abort

app = Flask(__name__)

# In‑memory session store: {session_token: {"user_id": ..., "expires_at": ...}}
_sessions = {}

# Configuration
SESSION_EXPIRY_SECONDS = 3600          # 1 hour
TOKEN_BYTE_LENGTH = 32                 # 256 bits of entropy


def _generate_token() -> str:
    """
    Generate a URL‑safe session token with at least 32 bytes (256 bits) of entropy.
    """
    raw_bytes = secrets.token_bytes(TOKEN_BYTE_LENGTH)
    # Use urlsafe base64 encoding without padding for easy transport in cookies/headers
    return secrets.base64.urlsafe_b64encode(raw_bytes).rstrip(b'=').decode('ascii')


def create_session(user_id: str) -> str:
    """
    Create a new session token, store it with the associated user ID and expiry timestamp,
    and return the token.
    """
    token = _generate_token()
    expires_at = datetime.utcnow() + timedelta(seconds=SESSION_EXPIRY_SECONDS)
    _sessions[token] = {"user_id": user_id, "expires_at": expires_at}
    return token


def validate_session(token: str) -> dict | None:
    """
    Validate a session token. Returns the stored session data if valid,
    otherwise returns None.
    """
    sess = _sessions.get(token)
    if not sess:
        return None
    if datetime.utcnow() > sess["expires_at"]:
        # Session expired – clean up
        del _sessions[token]
        return None
    return sess


def revoke_session(token: str) -> bool:
    """
    Invalidate a session token. Returns True if the token existed and was removed.
    """
    return _sessions.pop(token, None) is not None


@app.route("/login", methods=["POST"])
def login():
    """
    Example login endpoint that expects JSON with a 'user_id' field.
    In real usage you would verify credentials first.
    """
    data = request.get_json(silent=True)
    if not data or "user_id" not in data:
        abort(400, description="Missing user_id")
    token = create_session(str(data["user_id"]))
    resp = make_response(jsonify({"message": "Logged in"}))
    # Store the token in an HttpOnly secure cookie
    resp.set_cookie(
        "session_token",
        token,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=SESSION_EXPIRY_SECONDS,
    )
    return resp


@app.route("/protected", methods=["GET"])
def protected():
    """
    Example protected endpoint that requires a valid session.
    """
    token = request.cookies.get("session_token")
    if not token:
        abort(401, description="Missing session token")
    sess = validate_session(token)
    if not sess:
        abort(401, description="Invalid or expired session")
    return jsonify({"user_id": sess["user_id"], "status": "access granted"})


@app.route("/logout", methods=["POST"])
def logout():
    """
    Invalidate the current session.
    """
    token = request.cookies.get("session_token")
    if token:
        revoke_session(token)
    resp = make_response(jsonify({"message": "Logged out"}))
    resp.delete_cookie("session_token")
    return resp


if __name__ == "__main__":
    # For development only; use a proper WSGI server in production
    app.run(host="0.0.0.0", port=5000, debug=False)