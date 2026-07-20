```python
import os
import jwt
import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from functools import wraps

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import bcrypt

# ---------------------------------------------------------------------------
# App & config
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///bank.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

MIN_TRANSFER = Decimal("0.01")
MAX_TRANSFER = Decimal("1000000.00")


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    accounts = db.relationship("Account", back_populates="owner", lazy=True)

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.hashpw(
            password.encode(), bcrypt.gensalt()
        ).decode()

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode(), self.password_hash.encode()
        )


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    balance = db.Column(db.Numeric(precision=18, scale=2), nullable=False, default=0)
    currency = db.Column(db.String(3), nullable=False, default="USD")
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    owner = db.relationship("User", back_populates="accounts")
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "account_number": self.account_number,
            "balance": str(self.balance),
            "currency": self.currency,
        }


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    from_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    to_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    amount = db.Column(db.Numeric(precision=18, scale=2), nullable=False)
    currency = db.Column(db.String(3), nullable=False)
    timestamp = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    description = db.Column(db.String(256), nullable=True)
    initiated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    from_account = db.relationship("Account", foreign_keys=[from_account_id])
    to_account = db.relationship("Account", foreign_keys=[to_account_id])

    def to_dict(self) -> dict:
        return {
            "transaction_id": self.id,
            "from_account": self.from_account.account_number,
            "to_account": self.to_account.account_number,
            "amount": str(self.amount),
            "currency": self.currency,
            "timestamp": self.timestamp.isoformat(),
            "description": self.description,
        }


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 3600


def generate_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc).timestamp() + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm=JWT_ALGORITHM)


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token, app.config["SECRET_KEY"], algorithms=[JWT_ALGORITHM]
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        user = db.session.get(User, payload["sub"])
        if not user:
            return jsonify({"error": "User not found"}), 401
        return f(user, *args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_transfer_payload(data: dict) -> tuple[dict | None, str | None]:
    """Return (cleaned_data, error_message)."""
    from_account_number = (data.get("from_account_number") or "").strip()
    to_account_number = (data.get("to_account_number") or "").strip()
    description = (data.get("description") or "").strip()

    if not from_account_number:
        return None, "from_account_number is required"
    if not to_account_number:
        return None, "to_account_number is required"
    if from_account_number == to_account_number:
        return None, "Source and destination accounts must differ"

    raw_amount = data.get("amount")
    if raw_amount is None:
        return None, "amount is required"

    try:
        amount = Decimal(str(raw_amount))
    except InvalidOperation:
        return None, "amount must be a valid number"

    if amount < MIN_TRANSFER:
        return None, f"amount must be at least {MIN_TRANSFER}"
    if amount > MAX_TRANSFER:
        return None, f"amount must not exceed {MAX_TRANSFER}"

    # Enforce at most 2 decimal places
    if amount != amount.quantize(Decimal("0.01")):
        return None, "amount must have at most 2 decimal places"

    if len(description) > 255:
        return None, "description must not exceed 255 characters"

    return {
        "from_account_number": from_account_number,
        "to_account_number": to_account_number,
        "amount": amount,
        "description": description or None,
    }, None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
@limiter.limit("10 per hour")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or len(username) < 3:
        return jsonify({"error": "username must be at least 3 characters"}), 400
    if not