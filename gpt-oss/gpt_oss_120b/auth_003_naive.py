from flask import Flask, request, url_for, jsonify
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask_mail import Mail, Message
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

# ----------------------------------------------------------------------
# App & Extensions Setup
# ----------------------------------------------------------------------
app = Flask(__name__)

# ---- Configuration (replace placeholders with real values) ----
app.config.update(
    SECRET_KEY='your-secret-key',
    SECURITY_PASSWORD_SALT='your-password-salt',
    SQLALCHEMY_DATABASE_URI='sqlite:///users.db',   # example DB
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    MAIL_SERVER='smtp.example.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME='no-reply@example.com',
    MAIL_PASSWORD='email-password',
    MAIL_DEFAULT_SENDER=('YourApp Support', 'no-reply@example.com')
)

db = SQLAlchemy(app)
mail = Mail(app)
bcrypt = Bcrypt(app)
serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

# ----------------------------------------------------------------------
# Database Model (simplified)
# ----------------------------------------------------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    def set_password(self, raw_pw):
        self.password_hash = bcrypt.generate_password_hash(raw_pw).decode('utf-8')

# ----------------------------------------------------------------------
# Token Helpers
# ----------------------------------------------------------------------
def generate_reset_token(email: str) -> str:
    """Create a time‑limited token for password reset."""
    return serializer.dumps(email, salt=app.config['SECURITY_PASSWORD_SALT'])

def confirm_reset_token(token: str, expiration: int = 3600) -> str | None:
    """Validate token and return the embedded email if valid."""
    try:
        email = serializer.loads(
            token,
            salt=app.config['SECURITY_PASSWORD_SALT'],
            max_age=expiration
        )
    except (SignatureExpired, BadSignature):
        return None
    return email

# ----------------------------------------------------------------------
# Email Sender
# ----------------------------------------------------------------------
def send_password_reset_email(user: User) -> None:
    """Compose and dispatch the password‑reset e‑mail."""
    token = generate_reset_token(user.email)
    reset_url = url_for('reset_password', token=token, _external=True)

    subject = "Password Reset Request"
    body = f"""Hi {user.email},

We received a request to reset your password. Click the link below to choose a new password:

{reset_url}

If you did not request this change, simply ignore this email.

Thanks,
YourApp Team
"""

    msg = Message(subject=subject, recipients=[user.email], body=body)
    mail.send(msg)

# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.route('/password-reset-request', methods=['POST'])
def password_reset_request():
    """Endpoint to request a password‑reset link."""
    data = request.get_json()
    if not data or 'email' not in data:
        return jsonify({'message': 'Email is required'}), 400

    user = User.query.filter_by(email=data['email']).first()
    if user:
        send_password_reset_email(user)

    # Respond the same way regardless of existence to avoid enumeration
    return jsonify({
        'message': 'If an account with that email exists, a reset link has been sent.'
    }), 200

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    """Validate token (GET) or set new password (POST)."""
    if request.method == 'GET':
        email = confirm_reset_token(token)
        if not email:
            return jsonify({'message': 'Invalid or expired token'}), 400
        return jsonify({'message': 'Token valid. Submit new password via POST.'}), 200

    # POST – set new password
    data = request.get_json()
    if not data or 'password' not in data:
        return jsonify({'message': 'Password is required'}), 400

    email = confirm_reset_token(token)
    if not email:
        return jsonify({'message': 'Invalid or expired token'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'User not found'}), 404

    user.set_password(data['password'])
    db.session.commit()

    return jsonify({'message': 'Password has been reset successfully.'}), 200

# ----------------------------------------------------------------------
# App Entry Point
# ----------------------------------------------------------------------
if __name__ == '__main__':
    # Ensure DB tables exist (for demo purposes)
    with app.app_context():
        db.create_all()
    app.run(debug=True)