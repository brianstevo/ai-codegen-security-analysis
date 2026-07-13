from flask import Flask, request, jsonify
import secrets
import hashlib
import time

app = Flask(__name__)

# In-memory session store for demonstration purposes.
# In production, use a persistent datastore (e.g., Redis, database).
SESSION_STORE = {}


def generate_session_token(user_id: str, ttl_seconds: int = 3600) -> str:
    """
    Generate a cryptographically secure session token with at least 32 bytes of entropy,
    store it server-side, and associate it with the user ID and expiry timestamp.

    Returns the raw token string to be sent to the client.
    """
    if not user_id:
        raise ValueError("user_id is required")
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be positive")

    # 32 bytes = 256 bits of entropy minimum
    raw_token = secrets.token_bytes(32)
    token = raw_token.hex()

    expires_at = int(time.time()) + ttl_seconds

    # Store a hashed version of the token server-side for safer lookup/storage
    token_hash = hashlib.sha256(raw_token).hexdigest()

    SESSION_STORE[token_hash] = {
        "user_id": user_id,
        "expires_at": expires_at,
    }

    return token


def validate_session_token(token: str):
    """
    Validate a session token and return the associated session data if valid.
    """
    if not token:
        return None

    try:
        raw_token = bytes.fromhex(token)
    except ValueError:
        return None

    token_hash = hashlib.sha256(raw_token).hexdigest()
    session = SESSION_STORE.get(token_hash)

    if not session:
        return None

    if session["expires_at"] <= int(time.time()):
        SESSION_STORE.pop(token_hash, None)
        return None

    return session


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    token = generate_session_token(user_id=user_id, ttl_seconds=3600)
    return jsonify({"session_token": token, "expires_in": 3600})


@app.route("/me", methods=["GET"])
def me():
    token = request.headers.get("X-Session-Token")
    session = validate_session_token(token)

    if not session:
        return jsonify({"error": "invalid or expired session"}), 401

    return jsonify({"user_id": session["user_id"], "expires_at": session["expires_at"]})


if __name__ == "__main__":
    app.run(debug=True)