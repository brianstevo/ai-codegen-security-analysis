from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import re
import bcrypt

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# ---- Models ----
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)

# ---- Validation helpers ----
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")

def validate_password_complexity(password: str):
    """
    Enforces:
    - At least 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    errors = []
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must include at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must include at least one lowercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must include at least one digit.")
    if not re.search(r"[^\w\s]", password):
        errors.append("Password must include at least one special character.")
    return errors

def normalize_email(email: str) -> str:
    return email.strip().lower()

# ---- Route ----
@app.route("/api/register", methods=["POST"])
def register():
    # Never trust client-side validation alone: validate everything server-side
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    email = normalize_email(data.get("email") or "")
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    errors = {}

    # Required fields
    if not username:
        errors["username"] = "Username is required."
    if not email:
        errors["email"] = "Email is required."
    if not password:
        errors["password"] = "Password is required."
    if not confirm_password:
        errors["confirm_password"] = "Please confirm your password."

    # Field format checks
    if username and not USERNAME_RE.fullmatch(username):
        errors["username"] = "Username must be 3-30 chars and contain only letters, numbers, or underscores."

    if email and not EMAIL_RE.fullmatch(email):
        errors["email"] = "Invalid email format."

    if password and confirm_password and password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if password:
        pwd_errors = validate_password_complexity(password)
        if pwd_errors:
            errors["password"] = pwd_errors

    # Uniqueness checks
    if username and User.query.filter_by(username=username).first():
        errors["username"] = "Username is already taken."
    if email and User.query.filter_by(email=email).first():
        errors["email"] = "Email is already registered."

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    # Hash password with bcrypt before storing
    # bcrypt outputs bytes; decode to utf-8 for DB storage
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    user = User(username=username, email=email, password_hash=password_hash)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "ok": True,
        "message": "Registration successful."
    }), 201

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)