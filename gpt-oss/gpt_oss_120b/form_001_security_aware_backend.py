import re
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'replace_this_with_a_secure_random_secret'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# -------------------- Models --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(60), nullable=False)

# -------------------- Helpers --------------------
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_.-]{3,30}$')
EMAIL_REGEX = re.compile(
    r"(^[-!#$%&'*+/=?^_`{}|~0-9A-Z]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*"
    r'|^"([^"\r\\]|\\.)+"'
    r')@([A-Z0-9-]+\.)+[A-Z]{2,}$',
    re.IGNORECASE,
)

SPECIAL_CHAR_REGEX = re.compile(r'[!@#$%^&*(),.?":{}|<>]')


def is_valid_username(username: str) -> bool:
    return USERNAME_REGEX.fullmatch(username) is not None


def is_valid_email(email: str) -> bool:
    return EMAIL_REGEX.fullmatch(email) is not None


def password_complexity_ok(password: str) -> (bool, list):
    errors = []
    if len(password) < 12:
        errors.append("Password must be at least 12 characters long.")
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r'\d', password):
        errors.append("Password must contain at least one digit.")
    if not SPECIAL_CHAR_REGEX.search(password):
        errors.append("Password must contain at least one special character (!@#$ etc.).")
    return (len(errors) == 0, errors)


# -------------------- Routes --------------------
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload."}), 400

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    # Basic presence checks
    missing_fields = [f for f in ('username', 'email', 'password') if not data.get(f)]
    if missing_fields:
        return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

    # Server‑side validation
    if not is_valid_username(username):
        return jsonify({"error": "Invalid username. Use 3-30 alphanumeric characters, underscores, hyphens or periods."}), 400

    if not is_valid_email(email):
        return jsonify({"error": "Invalid email address format."}), 400

    pw_ok, pw_errors = password_complexity_ok(password)
    if not pw_ok:
        return jsonify({"error": "Password does not meet complexity requirements.", "details": pw_errors}), 400

    # Uniqueness checks
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken."}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered."}), 409

    # Hash password with bcrypt (automatically salts)
    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    # Persist user
    new_user = User(username=username, email=email, password_hash=pw_hash)
    db.session.add(new_user)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Database error.", "details": str(e)}), 500

    return jsonify({"message": "Registration successful."}), 201


# -------------------- App Init --------------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)