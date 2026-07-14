import os
from decimal import Decimal, InvalidOperation

from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy import CheckConstraint
from datetime import datetime, timedelta

# -------------------- App & Extensions --------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET", "super-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///funds.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# -------------------- Models --------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash

    accounts = db.relationship("Account", backref="owner", lazy=True)


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    balance = db.Column(
        db.Numeric(precision=20, scale=2), nullable=False, default=Decimal("0.00")
    )

    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_balance_non_negative"),
    )


# -------------------- Helper Functions --------------------
def generate_jwt(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=2),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(
            token, app.config["SECRET_KEY"], algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token")


def get_current_user() -> User:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        abort(401, description="Missing or malformed Authorization header")
    token = auth_header.split(maxsplit=1)[1]
    payload = decode_jwt(token)
    user = User.query.get(payload["sub"])
    if not user:
        abort(401, description="User not found")
    return user


def parse_decimal(value: str) -> Decimal:
    try:
        d = Decimal(value).quantize(Decimal("0.01"))
        if d <= 0:
            raise ValueError
        return d
    except (InvalidOperation, ValueError):
        abort(400, description="Amount must be a positive number with up to two decimal places")


# -------------------- Routes --------------------
@app.route("/transfer", methods=["POST"])
def transfer_funds():
    """
    Expected form fields / JSON:
        - from_account_id: int
        - to_account_id:   int
        - amount:          str (decimal)
        - password:       str (user's password for confirmation)
    """

    # Support both form-encoded and JSON payloads
    data = request.get_json(silent=True) or request.form

    required_fields = ["from_account_id", "to_account_id", "amount", "password"]
    if not all(field in data for field in required_fields):
        abort(400, description="Missing required fields")

    try:
        from_acc_id = int(data["from_account_id"])
        to_acc_id = int(data["to_account_id"])
    except ValueError:
        abort(400, description="Account IDs must be integers")

    amount = parse_decimal(str(data["amount"]))
    password = data["password"]

    # Authenticate user via JWT
    current_user = get_current_user()

    # Verify password again for extra security on transfers
    if not bcrypt.check_password_hash(current_user.password_hash, password):
        abort(403, description="Invalid password")

    # Load accounts
    from_account = Account.query.filter_by(id=from_acc_id).first()
    to_account = Account.query.filter_by(id=to_acc_id).first()

    if not from_account or not to_account:
        abort(404, description="One or both accounts not found")
    if from_account.user_id != current_user.id:
        abort(403, description="You do not own the source account")

    # Ensure sufficient funds
    if from_account.balance < amount:
        abort(400, description="Insufficient balance in source account")

    # Perform atomic transfer
    try:
        with db.session.begin_nested():
            from_account.balance -= amount
            to_account.balance += amount
            db.session.add(from_account)
            db.session.add(to_account)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(500, description="Database error during transfer")

    return jsonify(
        {
            "status": "success",
            "message": f"Transferred {str(amount)} from account {from_acc_id} to {to_acc_id}",
            "source_balance": str(from_account.balance),
            "destination_balance": str(to_account.balance),
        }
    ), 200


# -------------------- Optional: User Registration & Login (for testing) --------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or request.form
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        abort(400, description="Username and password required")
    if User.query.filter_by(username=username).first():
        abort(409, description="Username already exists")
    pw_hash = bcrypt.generate_password_hash(password)
    user = User(username=username, password_hash=pw_hash)
    db.session.add(user)
    db.session.commit()
    return jsonify({"status": "created", "user_id": user.id}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or request.form
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        abort(400, description="Username and password required")
    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        abort(401, description="Invalid credentials")
    token = generate_jwt(user.id)
    return jsonify({"access_token": token}), 200


# -------------------- Initialize DB (run once) --------------------
@app.before_first_request
def create_tables():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)