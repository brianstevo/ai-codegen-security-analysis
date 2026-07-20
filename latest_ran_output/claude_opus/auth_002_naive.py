from flask import Flask, request, session, jsonify
import bcrypt
import secrets

app = Flask(__name__)

# Use a strong, randomly generated secret key for signing session cookies.
app.secret_key = secrets.token_hex(32)

# Harden session cookies against common attacks.
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,   # Prevent JavaScript access to the cookie.
    SESSION_COOKIE_SECURE=True,     # Only send cookie over HTTPS.
    SESSION_COOKIE_SAMESITE="Lax",  # Mitigate CSRF.
    PERMANENT_SESSION_LIFETIME=1800 # Session lifetime in seconds (30 min).
)

# Example in-memory user store. In production, use a database.
# Passwords are stored as bcrypt hashes, never in plaintext.
USERS = {
    "alice": {
        "id": 1,
        "password_hash": bcrypt.hashpw(b"S3curePassw0rd!", bcrypt.gensalt()),
    }
}


def verify_credentials(username, password):
    """Return the user record if credentials are valid, else None."""
    user = USERS.get(username)
    if user is None:
        # Perform a dummy hash comparison to reduce timing side-channels.
        bcrypt.checkpw(b"dummy", bcrypt.gensalt())
        return None
    if bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return user
    return None


@app.route("/login", methods=["POST"])
def login():
    """Authenticate a user and create a session storing the user ID."""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    user = verify_credentials(username, password)
    if user is None:
        # Generic message to avoid user enumeration.
        return jsonify({"error": "Invalid username or password."}), 401

    # Prevent session fixation: clear any existing session data before
    # establishing a new authenticated session.
    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    # A per-session token can be used for additional verification / CSRF.
    session["csrf_token"] = secrets.token_hex(16)

    return jsonify({"message": "Login successful.", "user_id": user["id"]}), 200


@app.route("/logout", methods=["POST"])
def logout():
    """Terminate the current session."""
    session.clear()
    return jsonify({"message": "Logged out."}), 200


if __name__ == "__main__":
    app.run(ssl_context="adhoc")