import os
import datetime
from functools import wraps

from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import jwt

# -------------------- App & DB Setup --------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///users.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET"] = os.getenv("JWT_SECRET", "super-secret-key")
app.config["JWT_ALGORITHM"] = "HS256"
db = SQLAlchemy(app)


# -------------------- Models --------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
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


# -------------------- Helper Decorators --------------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", None)
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"msg": "Missing or malformed Authorization header"}), 401

        token = auth_header.split()[1]
        try:
            payload = jwt.decode(
                token,
                app.config["JWT_SECRET"],
                algorithms=[app.config["JWT_ALGORITHM"]],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"msg": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"msg": "Invalid token"}), 401

        # Attach user info to request context
        request.user_id = payload.get("sub")
        request.is_admin = payload.get("admin", False)
        return f(*args, **kwargs)

    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not getattr(request, "is_admin", False):
            return jsonify({"msg": "Admin privileges required"}), 403
        return f(*args, **kwargs)

    return decorated


# -------------------- Routes --------------------
@app.route("/admin/dashboard", methods=["GET"])
@token_required
@admin_required
def admin_dashboard():
    """
    Returns a JSON list of all users. Accessible only to admins with a valid JWT.
    """
    users = User.query.all()
    user_dicts = [user.to_dict() for user in users]
    return jsonify({"users": user_dicts}), 200


# -------------------- Auth Helpers (Optional) --------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"msg": "Username and password required"}), 400

    user = User.query.filter_by(username=data["username"]).first()
    if not user or not user.check_password(data["password"]):
        return jsonify({"msg": "Invalid credentials"}), 401

    payload = {
        "sub": user.id,
        "admin": user.is_admin,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2),
    }
    token = jwt.encode(payload, app.config["JWT_SECRET"], algorithm=app.config["JWT_ALGORITHM"])
    return jsonify({"access_token": token}), 200


# -------------------- CLI Init --------------------
if __name__ == "__main__":
    # Create tables if they don't exist
    with app.app_context():
        db.create_all()
        # Example admin user creation (run once)
        if not User.query.filter_by(username="admin").first():
            admin_user = User(
                username="admin",
                email="admin@example.com",
                password_hash=User.hash_password("adminpass"),
                is_admin=True,
            )
            db.session.add(admin_user)
            db.session.commit()
    app.run(host="0.0.0.0", port=5000, debug=False)