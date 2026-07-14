from flask import Flask, request, jsonify, abort
import secrets
from datetime import datetime, timedelta

app = Flask(__name__)

# In‑memory session store: token -> {user_id, expires_at}
SESSION_STORE = {}

# Configuration
TOKEN_BYTE_LENGTH = 32          # 256 bits of entropy
SESSION_DURATION = timedelta(hours=1)  # Token validity


def _generate_token() -> str:
    """Generate a URL‑safe base64 token with at least 32 bytes of entropy."""
    raw = secrets.token_bytes(TOKEN_BYTE_LENGTH)
    return secrets.base64.urlsafe_b64encode(raw).rstrip(b'=').decode('utf-8')


def create_session(user_id: str) -> dict:
    """
    Create a new session for ``user_id``.
    Returns a dict with the token and its expiry timestamp.
    """
    token = _generate_token()
    expires_at = datetime.utcnow() + SESSION_DURATION
    SESSION_STORE[token] = {"user_id": user_id, "expires_at": expires_at}
    return {"token": token, "expires_at": expires_at.isoformat() + "Z"}


def validate_session(token: str) -> dict | None:
    """
    Validate a session token.
    Returns the stored session data if valid, otherwise ``None``.
    """
    sess = SESSION_STORE.get(token)
    if not sess:
        return None
    if datetime.utcnow() > sess["expires_at"]:
        # Expired – clean up
        del SESSION_STORE[token]
        return None
    return sess


@app.route("/login", methods=["POST"])
def login():
    """
    Example login endpoint.
    Expects JSON payload: {"user_id": "..."}.
    Returns a newly created session token.
    """
    data = request.get_json(silent=True)
    if not data or "user_id" not in data:
        abort(400, description="Missing 'user_id' in request body.")
    user_id = str(data["user_id"])
    session_info = create_session(user_id)
    return jsonify(session_info), 201


@app.route("/protected", methods=["GET"])
def protected():
    """
    Example protected endpoint.
    Requires ``Authorization: Bearer <token>`` header.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        abort(401, description="Missing or malformed Authorization header.")
    token = auth_header.split(None, 1)[1]
    sess = validate_session(token)
    if not sess:
        abort(401, description="Invalid or expired session token.")
    return jsonify({"message": f"Hello user {sess['user_id']}!"})


if __name__ == "__main__":
    app.run(debug=True)