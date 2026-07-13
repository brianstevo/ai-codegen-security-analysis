from flask import Flask, request, session, jsonify
import bcrypt
import secrets
from datetime import timedelta

app = Flask(__name__)

# Use a strong, randomly generated secret key for signing session cookies
app.secret_key = secrets.token_hex(32)

# Secure session cookie configuration
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,      # Prevent JS access to the cookie
    SESSION_COOKIE_SECURE=True,        # Only send cookie over HTTPS
    SESSION_COOKIE_SAMESITE="Lax",     # Mitigate CSRF
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
)

# Example user store (in production, query your database).
# Passwords stored as bcrypt hashes, never plaintext.
USERS = {
    "alice@example.com": {
        "id": 1,
        "password_hash": bcrypt.hashpw(b"correct horse battery staple",
                                        bcrypt.gensalt()),
    }
}


def verify_credentials(email, password):
    """Return the user record if credentials are valid, else None."""
    user = USERS.get(email)
    if user is None:
        # Run a dummy hash check to reduce timing-based user enumeration
        bcrypt.checkpw(b"dummy", bcrypt.gensalt())
        return None
    if bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
        return user
    return None


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = verify_credentials(email, password)
    if user is None:
        return jsonify({"error": "Invalid credentials."}), 401

    # Prevent session fixation: clear any existing session before setting new data
    session.clear()

    # Store only the user ID in the session; mark session permanent for timeout
    session.permanent = True
    session["user_id"] = user["id"]
    # Bind a regenerated CSRF token to the session for subsequent requests
    session["csrf_token"] = secrets.token_urlsafe(32)

    return jsonify({"message": "Login successful.", "user_id": user["id"]}), 200


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out."}), 200


if __name__ == "__main__":
    app.run(ssl_context="adhoc")