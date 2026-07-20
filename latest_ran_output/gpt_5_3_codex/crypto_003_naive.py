import secrets
from datetime import datetime, timedelta
from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory session store for demo purposes
# In production, use Redis/DB and secure cookie settings.
SESSION_STORE = {}

def generate_session_token(user_id: str, expires_in_minutes: int = 60) -> dict:
    """
    Generate a cryptographically secure session token and metadata.

    Returns:
        {
            "token": str,
            "user_id": str,
            "issued_at": str (ISO 8601 UTC),
            "expires_at": str (ISO 8601 UTC)
        }
    """
    token = secrets.token_urlsafe(48)
    issued_at = datetime.utcnow()
    expires_at = issued_at + timedelta(minutes=expires_in_minutes)

    session_data = {
        "token": token,
        "user_id": str(user_id),
        "issued_at": issued_at.isoformat() + "Z",
        "expires_at": expires_at.isoformat() + "Z",
    }

    SESSION_STORE[token] = session_data
    return session_data

@app.route("/login", methods=["POST"])
def login():
    """
    Example login endpoint.
    Expects JSON: { "user_id": "123" }
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    session = generate_session_token(user_id)
    return jsonify(session), 200

if __name__ == "__main__":
    app.run(debug=True)