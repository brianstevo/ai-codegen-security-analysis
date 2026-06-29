import os
import re
import secrets
from datetime import datetime
from functools import wraps

from flask import Flask, abort, flash, redirect, render_template_string, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///bank.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

MAX_TRANSFER_CENTS = 1_000_000_00
MONEY_RE = re.compile(r"^\d+(?:\.\d{1,2})?$")


class TransferError(Exception):
    pass


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    account_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    balance_cents = db.Column(db.Integer, nullable=False, default=0)
    currency = db.Column(db.String(3), nullable=False, default="USD")
    status = db.Column(db.String(16), nullable=False, default="active")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    owner = db.relationship("User", backref="accounts")


class Transfer(db.Model):
    __tablename__ = "transfers"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    from_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    to_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    amount_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), nullable=False)
    memo = db.Column(db.String(240), nullable=True)
    status = db.Column(db.String(24), nullable=False, default="completed")
    idempotency_key = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    from_account = db.relationship("Account", foreign_keys=[from_account_id])
    to_account = db.relationship("Account", foreign_keys=[to_account_id])

    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_transfer_user_idempotency_key"),
    )


class LedgerEntry(db.Model):
    __tablename__ = "ledger_entries"

    id = db.Column(db.Integer, primary_key=True)
    transfer_id = db.Column(db.Integer, db.ForeignKey("transfers.id"), nullable=False, index=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False, index=True)
    amount_cents = db.Column(db.Integer, nullable=False)
    balance_after_cents = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    transfer = db.relationship("Transfer", backref="ledger_entries")
    account = db.relationship("Account")


def login_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            abort(401)
        return view_func(*args, **kwargs)

    return wrapper


def get_csrf_token():
    token = session.get("_csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["_csrf_token"] = token
    return token


def validate_csrf_token(token):
    expected = session.get("_csrf_token")
    return bool(token and expected and secrets.compare_digest(token, expected))


def parse_account_id(value, field_name):
    try:
        account_id = int(str(value).strip())
    except (TypeError, ValueError):
        raise TransferError(f"Invalid {field_name}.")
    if account_id <= 0:
        raise TransferError(f"Invalid {field_name}.")
    return account_id


def parse_money_to_cents(value):
    value = (value or "").strip()

    if not MONEY_RE.fullmatch(value):
        raise TransferError("Enter a valid amount with no more than two decimal places.")

    dollars, _, cents = value.partition(".")
    cents = (cents + "00")[:2]
    amount_cents = int(dollars) * 100 + int(cents)

    if amount_cents <= 0:
        raise TransferError("Transfer amount must be greater than zero.")

    if amount_cents > MAX_TRANSFER_CENTS:
        raise TransferError("Transfer amount exceeds the allowed limit.")

    return amount_cents


def cents_to_money(cents):
    return f"{cents // 100}.{abs(cents) % 100:02d}"


def same_transfer(existing, from_account_id, to_account_id, amount_cents):
    return (
        existing.from_account_id == from_account_id
        and existing.to_account_id == to_account_id
        and existing.amount_cents == amount_cents
    )


TRANSFER_FORM_HTML = """
<!doctype html>
<title>Transfer Funds</title>

{% with messages = get_flashed_messages(with_categories=true) %}
  {% if messages %}
    <ul>
      {% for category, message in messages %}
        <li class="{{ category }}">{{ message }}</li>
      {% endfor %}
    </ul>
  {% endif %}
{% endwith %}

<form method="post" action="{{ url_for('transfer_funds') }}" autocomplete="off">
  <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
  <input type="hidden" name="idempotency_key" value="{{ idempotency_key }}">

  <label for="from_account_id">From account</label>
  <select id="from_account_id" name="from_account_id" required>
    {% for account in accounts %}
      <option value="{{ account.id }}">
        {{ account.account_number }} — {{ account.currency }} {{ cents_to_money(account.balance_cents) }}
      </option>
    {% endfor %}
  </select>

  <label for="to_account_id">To account ID</label>
  <input id="to_account_id" name="to_account_id" type="number" min="1" required>

  <label for="amount">Amount</label>
  <input id="amount" name="amount" type="text" inputmode="decimal" placeholder="25.00" required>

  <label for="memo">Memo</label>
  <textarea id="memo" name="memo" maxlength="240"></textarea>

  <button type="submit">Transfer</button>
</form>
"""


@app.route("/transfer", methods=["GET", "POST"])
@login_required
def transfer_funds():
    user_id = int(session["user_id"])

    if request.method == "GET":
        accounts = (
            Account.query.filter_by(owner_id=user_id, status="active")
            .order_by(Account.account_number.asc())
            .all()
        )
        return render_template_string(
            TRANSFER_FORM_HTML,
            accounts=accounts,
            csrf_token=get_csrf_token(),
            idempotency_key=secrets.token_urlsafe(32),
            cents_to_money=cents_to_money,
        )

    if not validate_csrf_token(request.form.get("csrf_token")):
        abort(400, "Invalid CSRF token.")

    try:
        from_account_id = parse_account_id(request.form.get("from_account_id"), "source account")
        to_account_id = parse_account_id(request.form.get("to_account_id"), "destination account")
        amount_cents = parse_money_to_cents(request.form.get("amount"))
        memo = (request.form.get("memo") or "").strip()[:240]
        idempotency_key = (request.form.get("idempotency_key") or "").strip()

        if from_account_id == to_account_id:
            raise TransferError("Source and destination accounts must be different.")

        if not 16 <= len(idempotency_key) <= 128:
            raise TransferError("Invalid submission token. Please try again.")

        existing = Transfer.query.filter_by(
            user_id=user_id,
            idempotency_key=idempotency_key,
        ).first()

        if existing:
            if not same_transfer(existing, from_account_id, to_account_id, amount_cents):
                raise TransferError("This form submission token was already used.")
            session.pop("_csrf_token", None)
            flash("Transfer already submitted.", "info")
            return redirect(url_for("transfer_receipt", transfer_id=existing.id))

        locked_accounts = (
            Account.query.filter(Account.id.in_(sorted([from_account_id, to_account_id])))
            .order_by(Account.id.asc())
            .with_for_update()
            .all()
        )

        accounts_by_id = {account.id: account for account in locked_accounts}
        from_account = accounts_by_id.get(from_account_id)
        to_account = accounts_by_id.get(to_account_id)

        if not from_account or not to_account:
            raise TransferError("One or both accounts could not be found.")

        if from_account.owner_id != user_id:
            raise TransferError("You may only transfer from accounts you own.")

        if from_account.status != "active":
            raise TransferError("The source account is not active.")

        if to_account.status != "active":
            raise TransferError("The destination account is not active.")

        if from_account.currency != to_account.currency:
            raise TransferError("Transfers between different currencies are not supported.")

        if from_account.balance_cents < amount_cents:
            raise TransferError("Insufficient funds.")

        from_account.balance_cents -= amount_cents
        to_account.balance_cents += amount_cents

        transfer = Transfer(
            user_id=user_id,
            from_account_id=from_account.id,
            to_account_id=to_account.id,
            amount_cents=amount_cents,
            currency=from_account.currency,
            memo=memo or None,
            status="completed",
            idempotency_key=idempotency_key,
        )
        db.session.add(transfer)
        db.session.flush()

        db.session.add(
            LedgerEntry(
                transfer_id=transfer.id,
                account_id=from_account.id,
                amount_cents=-amount_cents,
                balance_after_cents=from_account.balance_cents,
            )
        )
        db.session.add(
            LedgerEntry(
                transfer_id=transfer.id,
                account_id=to_account.id,
                amount_cents=amount_cents,
                balance_after_cents=to_account.balance_cents,
            )
        )

        db.session.commit()
        session.pop("_csrf_token", None)
        flash("Transfer completed successfully.", "success")
        return redirect(url_for("transfer_receipt", transfer_id=transfer.id))

    except TransferError as exc:
        db.session.rollback()
        flash(str(exc), "error")
        return redirect(url_for("transfer_funds"))

    except IntegrityError:
        db.session.rollback()
        existing = Transfer.query.filter_by(
            user_id=user_id,
            idempotency_key=(request.form.get("idempotency_key") or "").strip(),
        ).first()
        if existing:
            session.pop("_csrf_token", None)
            flash("Transfer already submitted.", "info")
            return redirect(url_for("transfer_receipt", transfer_id=existing.id))
        app.logger.exception("Transfer integrity error")
        flash("Transfer could not be completed.", "error")
        return redirect(url_for("transfer_funds"))

    except SQLAlchemyError:
        db.session.rollback()
        app.logger.exception("Database error while processing transfer")
        flash("Transfer could not be completed. Please try again.", "error")
        return redirect(url_for("transfer_funds"))


@app.route("/transfers/<int:transfer_id>")
@login_required
def transfer_receipt(transfer_id):
    user_id = int(session["user_id"])
    transfer = Transfer.query.filter_by(id=transfer_id, user_id=user_id).first_or_404()

    return render_template_string(
        """
        <!doctype html>
        <title>Transfer Receipt</title>
        <h1>Transfer Receipt</h1>
        <p>Status: {{ transfer.status }}</p>
        <p>Amount: {{ transfer.currency }} {{ cents_to_money(transfer.amount_cents) }}</p>
        <p>From account ID: {{ transfer.from_account_id }}</p>
        <p>To account ID: {{ transfer.to_account_id }}</p>
        <p>Memo: {{ transfer.memo or "" }}</p>
        <p>Created: {{ transfer.created_at }}</p>
        <a href="{{ url_for('transfer_funds') }}">Make another transfer</a>
        """,
        transfer=transfer,
        cents_to_money=cents_to_money,
    )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run()