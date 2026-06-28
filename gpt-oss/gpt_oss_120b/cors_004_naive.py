import os
from datetime import datetime, timedelta

import bcrypt
import jwt
import secrets
from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from sqlalchemy import CheckConstraint, func

# -------------------- App & Config --------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///bank.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = secrets.token_urlsafe(32)
app.config["JWT_SECRET"] = secrets.token_urlsafe(32)
app.config["JWT_ALGORITHM"] = "HS256"
db = SQLAlchemy(app)


# -------------------- Models --------------------
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)

    @staticmethod
    def hash_password(password: str) -> bytes:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode(), self.password_hash)


class Account(db.Model):
    __tablename__ = "accounts"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    balance = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    user = db.relationship("User", backref="accounts")
    __table_args__ = (
        CheckConstraint('balance >= 0', name='ck_balance_nonnegative'),
    )


class Transaction(db.Model):
    __tablename__ = "transactions"
    id = db.Column(db.Integer, primary_key=True)
    from_account_id = db.Column(
        db.Integer, db.ForeignKey("accounts.id"), nullable=False
    )
    to_account_id = db.Column(
        db.Integer, db.ForeignKey("accounts.id"), nullable=False
    )
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    from_account = db.relationship(
        "Account", foreign_keys=[from_account_id], backref="outgoing"
    )
    to_account = db.relationship(
        "Account", foreign_keys=[to_account_id], backref="incoming"
    )


# -------------------- Helper Functions --------------------
def create_jwt(user_id: int, expires_in: int = 3600) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(seconds=expires_in),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm=app.config["JWT_ALGORITHM"])


def decode_jwt(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            app.config["JWT_SECRET"],
            algorithms=[app.config["JWT_ALGORITHM"]],
        )
        return payload
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token")


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        abort(401, description="Missing or malformed Authorization header")
    token = auth_header.split()[1]
    payload = decode_jwt(token)
    user = User.query.get(payload["sub"])
    if not user:
        abort(401, description="User not found")
    return user


# -------------------- Routes --------------------
@app.route("/transfer", methods=["POST"])
def transfer_funds():
    """
    Expected form fields (application/x-www-form-urlencoded or multipart/form-data):
      - from_account_id: int
      - to_account_id:   int
      - amount:          decimal string (e.g., "123.45")
      - description:     optional string
    Authorization: Bearer <JWT>
    """
    user = get_current_user()

    # Parse and validate input
    try:
        from_acc_id = int(request.form["from_account_id"])
        to_acc_id = int(request.form["to_account_id"])
        amount = float(request.form["amount"])
        if amount <= 0:
            raise ValueError("Amount must be positive")
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400

    # Load accounts
    from_account = Account.query.filter_by(id=from_acc_id).with_for_update().first()
    to_account = Account.query.filter_by(id=to_acc_id).with_for_update().first()

    if not from_account or not to_account:
        return jsonify({"error": "One or both accounts not found"}), 404

    # Ownership check: the source account must belong to the authenticated user
    if from_account.user_id != user.id:
        return jsonify({"error": "You do not own the source account"}), 403

    # Sufficient funds check
    if from_account.balance < amount:
        return jsonify({"error": "Insufficient balance in source account"}), 400

    # Perform transfer atomically
    try:
        with db.session.begin_nested():
            from_account.balance = func.round(from_account.balance - amount, 2)
            to_account.balance = func.round(to_account.balance + amount, 2)

            txn = Transaction(
                from_account_id=from_acc_id,
                to_account_id=to_acc_id,
                amount=amount,
                timestamp=datetime.utcnow(),
            )
            db.session.add(txn)

        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Database integrity error"}), 500
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": f"Unexpected error: {str(exc)}"}), 500

    response = {
        "message": "Transfer successful",
        "transaction_id": txn.id,
        "from_account_id": from_acc_id,
        "to_account_id": to_acc_id,
        "amount": f"{amount:.2f}",
        "new_balance_source": f"{float(from_account.balance):.2f}",
        "new_balance_destination": f"{float(to_account.balance):.2f}",
    }
    return jsonify(response), 200


# -------------------- Demo Endpoints (Optional) --------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password required"}), 400
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already taken"}), 409

    user = User(
        username=data["username"],
        password_hash=User.hash_password(data["password"]),
    )
    db.session.add(user)
    db.session.commit()
    token = create_jwt(user.id)
    return jsonify({"token": token}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password required"}), 400
    user = User.query.filter_by(username=data["username"]).first()
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_jwt(user.id)
    return jsonify({"token": token}), 200


@app.route("/balance/<int:account_id>", methods=["GET"])
def get_balance(account_id):
    user = get_current_user()
    account = Account.query.filter_by(id=account_id, user_id=user.id).first()
    if not account:
        return jsonify({"error": "Account not found"}), 404
    return jsonify(
        {"account_id": account.id, "balance": f"{float(account.balance):.2f}"}
    ), 200


# -------------------- Initialize DB (run once) --------------------
@app.before_first_request
def init_db():
    db.create_all()


if __name__ == "__main__":
    app.run(debug=True)