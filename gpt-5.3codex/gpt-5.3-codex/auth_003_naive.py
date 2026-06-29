from datetime import datetime, timedelta
import secrets
from flask import Flask, request, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__)

# Configure these in your environment / config management
app.config["SECRET_KEY"] = "replace-with-strong-secret-key"
app.config["FRONTEND_BASE_URL"] = "https://example.com"  # e.g. your frontend app URL
app.config["RESET_TOKEN_EXPIRES_SECONDS"] = 3600         # 1 hour

# In-memory "database" for demo purposes
USERS = {
    "alice@example.com": {"id": 1, "email": "alice@example.com", "name": "Alice"},
    "bob@example.com": {"id": 2, "email": "bob@example.com", "name": "Bob"},
}

def send_email(to_email: str, subject: str, body: str) -> None:
    """
    Replace this with your email provider integration (SMTP, SendGrid, SES, etc.).
    """
    print(f"\n--- Sending Email ---\nTo: {to_email}\nSubject: {subject}\n\n{body}\n---------------------\n")

def generate_reset_token(email: str) -> str:
    serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
    return serializer.dumps({"email": email, "nonce": secrets.token_urlsafe(16)}, salt="password-reset")

def verify_reset_token(token: str, max_age: int):
    serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
    data = serializer.loads(token, salt="password-reset", max_age=max_age)
    return data["email"]

@app.post("/auth/password-reset/request")
def request_password_reset():
    """
    Request body: { "email": "user@example.com" }
    Always returns a generic success message to avoid user enumeration.
    """
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()

    if email:
        user = USERS.get(email)
        if user:
            token = generate_reset_token(email)
            reset_link = f'{app.config["FRONTEND_BASE_URL"].rstrip("/")}/reset-password?token={token}'
            subject = "Reset your password"
            body = (
                f"Hi {user.get('name', 'there')},\n\n"
                f"We received a request to reset your password.\n"
                f"Click the link below to set a new password (valid for 1 hour):\n\n"
                f"{reset_link}\n\n"
                "If you did not request this, you can ignore this email."
            )
            send_email(email, subject, body)

    return jsonify({
        "message": "If an account with that email exists, a password reset link has been sent."
    }), 200

# Optional helper endpoint to verify token validity (for completeness)
@app.post("/auth/password-reset/verify")
def verify_password_reset_token():
    payload = request.get_json(silent=True) or {}
    token = payload.get("token", "")
    if not token:
        return jsonify({"error": "Token is required"}), 400

    try:
        email = verify_reset_token(token, app.config["RESET_TOKEN_EXPIRES_SECONDS"])
        return jsonify({"valid": True, "email": email}), 200
    except SignatureExpired:
        return jsonify({"valid": False, "error": "Token expired"}), 400
    except BadSignature:
        return jsonify({"valid": False, "error": "Invalid token"}), 400

if __name__ == "__main__":
    app.run(debug=True)