import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt

# -------------------- App & DB Setup --------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///./app.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "super-secret-key")
db = SQLAlchemy(app)


# -------------------- Models --------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_admin": self.is_admin,
        }

    @staticmethod
    def hash_password(plain_pw: str) -> bytes:
        return bcrypt.hashpw(plain_pw.encode("utf-8"), bcrypt.gensalt())

    def check_password(self, plain_pw: str) -> bool:
        return bcrypt.checkpw(plain_pw.encode("utf-8"), self.password_hash)


# -------------------- JWT Helpers --------------------
def generate_jwt(user: User, expires_in=timedelta(hours=2)):
    payload = {
        "sub": user.id,
        "username": user.username,
        "is_admin": user.is_admin,
        "exp": datetime.utcnow() + expires_in,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")
    return token


def decode_jwt(token: str):
    try:
        payload = jwt.decode(
            token, app.config["SECRET_KEY"], algorithms=["HS256"]
        )
        return payload
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token")


def admin_required(fn):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            abort(401, description="Missing Bearer token")
        token = auth_header.split()[1]
        payload = decode_jwt(token)
        if not payload.get("is_admin"):
            abort(403, description="Admin privileges required")
        # Attach user info to request context if needed
        request.user_payload = payload
        return fn(*args, **kwargs)

    wrapper.__name__ = fn.__name__
    return wrapper


# -------------------- Routes --------------------
@app.route("/admin/dashboard", methods=["GET"])
@admin_required
def admin_dashboard():
    """
    Returns a JSON list of all users. Accessible only by admins.
    """
    users = User.query.all()
    user_dicts = [user.to_dict() for user in users]
    return jsonify({"users": user_dicts}), 200


# -------------------- Example Auth Endpoints (Optional) --------------------
@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        abort(400, description="Username and password required")

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        abort(401, description="Invalid credentials")

    token = generate_jwt(user)
    return jsonify({"access_token": token}), 200


@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    is_admin = bool(data.get("is_admin", False))

    if not all([username, email, password]):
        abort(400, description="Missing registration fields")

    if User.query.filter((User.username == username) | (User.email == email)).first():
        abort(409, description="User already exists")

    new_user = User(
        username=username,
        email=email,
        password_hash=User.hash_password(password),
        is_admin=is_admin,
    )
    db.session.add(new_user)
    db.session.commit()

    token = generate_jwt(new_user)
    return jsonify({"access_token": token}), 201


# -------------------- CLI Helper --------------------
if __name__ == "__main__":
    # Ensure DB tables exist
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)