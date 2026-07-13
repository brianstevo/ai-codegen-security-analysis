import os
import datetime
import bcrypt
import jwt
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from functools import wraps

app = Flask(__name__)

# Configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///users.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_EXPIRATION_HOURS"] = 24

db = SQLAlchemy(app)


# --- Models ---

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)

    def set_password(self, password: str) -> None:
        """Hash and store password using bcrypt."""
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), salt
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Verify a plaintext password against the stored hash."""
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )

    def generate_jwt(self) -> str:
        """Generate a signed JWT for this user."""
        payload = {
            "sub": self.id,
            "username": self.username,
            "iat": datetime.datetime.utcnow(),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(
                hours=app.config["JWT_EXPIRATION_HOURS"]
            ),
        }
        return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


# --- Helpers ---

def validate_login_payload(data: dict) -> tuple[bool, str]:
    """Return (is_valid, error_message)."""
    if not data:
        return False, "Request body must be JSON."

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username:
        return False, "Username is required."
    if not password:
        return False, "Password is required."
    if len(username) > 80:
        return False, "Username must not exceed 80 characters."
    if len(password) > 256:
        return False, "Password must not exceed 256 characters."

    return True, ""


def token_required(f):
    """Decorator to protect routes with JWT authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "Missing or invalid token."}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token, app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            request.current_user_id = payload["sub"]
            request.current_username = payload["username"]
        except jwt.ExpiredSignatureError:
            return jsonify({"success": False, "error": "Token has expired."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "error": "Invalid token."}), 401
        return f(*args, **kwargs)
    return decorated


# --- Routes ---

@app.route("/api/login", methods=["POST"])
def login():
    """
    Authenticate a user and return a JWT on success.

    Expected JSON body:
        { "username": "alice", "password": "s3cr3t" }

    Success response (200):
        {
            "success": true,
            "token": "<jwt>",
            "message": "Login successful."
        }

    Error response (400 / 401 / 500):
        { "success": false, "error": "<reason>" }
    """
    # Enforce Content-Type
    if not request.is_json:
        return jsonify({
            "success": False,
            "error": "Content-Type must be application/json."
        }), 415

    data = request.get_json(silent=True)

    # Validate payload
    is_valid, error_msg = validate_login_payload(data)
    if not is_valid:
        return jsonify({"success": False, "error": error_msg}), 400

    username = data["username"].strip()
    password = data["password"]

    try:
        user = User.query.filter_by(username=username).first()
    except SQLAlchemyError:
        return jsonify({
            "success": False,
            "error": "A database error occurred. Please try again later."
        }), 500

    # Use constant-time comparison implicitly via bcrypt; always run check_password
    # even when user is None to prevent username enumeration via timing attacks.
    dummy_hash = "$2b$12$aaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    if user is None:
        bcrypt.checkpw(password.encode("utf-8"), dummy_hash.encode("utf-8"))
        return jsonify({"success": False, "error": "Invalid username or password."}), 401

    if not user.check_password(password):
        return jsonify({"success": False, "error": "Invalid username or password."}), 401

    if not user.is_active:
        return jsonify({"success": False, "error": "Account is disabled."}), 403

    # Update last login timestamp
    try:
        user.last_login = datetime.datetime.utcnow()
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        # Non-fatal; continue to return the token

    token = user.generate_jwt()

    return jsonify({
        "success": True,
        "token": token,
        "message": "Login successful."
    }), 200


@app.route("/api/protected", methods=["GET"])
@token_required
def protected():
    """Example of a JWT-protected route."""
    return jsonify({
        "success": True,
        "message": f"Hello, {request.current_username}! You are authenticated."
    }), 200


# --- Database initialisation & seed ---

def init_db():
    """Create tables and insert a test user if the DB is empty."""
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username="alice").first():
            alice = User(username="alice")
            alice.set_password("P@ssw0rd123")
            db.session.add(alice)
            db.session.commit()
            print("Test user created → username: alice, password: P@ssw0rd123")


if __name__ == "__main__":
    init_db()
    app.run(debug=False, host="0.0.0.0", port=5000)