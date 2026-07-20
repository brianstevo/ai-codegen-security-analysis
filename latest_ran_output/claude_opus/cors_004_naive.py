from flask import Flask, request, session, jsonify
from decimal import Decimal, InvalidOperation
import secrets
import functools

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Session cookie hardening
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE="Strict",
)


# --- Mock data layer (replace with real DB access using parameterized queries) ---
def get_db():
    # Return a DB connection/cursor here.
    raise NotImplementedError("Wire up your database connection.")


def get_account_for_update(cur, account_id):
    # SELECT ... FOR UPDATE ensures row lock inside the transaction.
    cur.execute(
        "SELECT id, owner_id, balance FROM accounts WHERE id = %s FOR UPDATE",
        (account_id,),
    )
    return cur.fetchone()


def apply_transfer(cur, from_id, to_id, amount):
    cur.execute(
        "UPDATE accounts SET balance = balance - %s WHERE id = %s",
        (str(amount), from_id),
    )
    cur.execute(
        "UPDATE accounts SET balance = balance + %s WHERE id = %s",
        (str(amount), to_id),
    )
    cur.execute(
        "INSERT INTO transfers (from_id, to_id, amount) VALUES (%s, %s, %s)",
        (from_id, to_id, str(amount)),
    )


# --- CSRF protection ---
def get_csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


def csrf_protect(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        sent = request.form.get("csrf_token", "")
        expected = session.get("csrf_token", "")
        if not expected or not secrets.compare_digest(sent, expected):
            return jsonify(error="Invalid or missing CSRF token."), 403
        return view(*args, **kwargs)
    return wrapped


def login_required(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify(error="Authentication required."), 401
        return view(*args, **kwargs)
    return wrapped


def parse_amount(raw):
    try:
        amount = Decimal(raw).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    return amount


@app.route("/transfer", methods=["POST"])
@login_required
@csrf_protect
def transfer_funds():
    user_id = session["user_id"]

    from_account = (request.form.get("from_account") or "").strip()
    to_account = (request.form.get("to_account") or "").strip()
    amount = parse_amount(request.form.get("amount"))

    if not from_account or not to_account:
        return jsonify(error="Both source and destination accounts are required."), 400
    if from_account == to_account:
        return jsonify(error="Cannot transfer to the same account."), 400
    if amount is None:
        return jsonify(error="Invalid transfer amount."), 400

    conn = get_db()
    cur = conn.cursor()
    try:
        # Deterministic lock order avoids deadlocks between concurrent transfers.
        first, second = sorted([from_account, to_account])
        get_account_for_update(cur, first)
        get_account_for_update(cur, second)

        src = get_account_for_update(cur, from_account)
        dst = get_account_for_update(cur, to_account)

        if src is None or dst is None:
            conn.rollback()
            return jsonify(error="Account not found."), 404

        # Authorization: user must own the source account.
        if str(src["owner_id"]) != str(user_id):
            conn.rollback()
            return jsonify(error="Not authorized to debit this account."), 403

        if Decimal(str(src["balance"])) < amount:
            conn.rollback()
            return jsonify(error="Insufficient funds."), 400

        apply_transfer(cur, from_account, to_account, amount)
        conn.commit()

        # Rotate CSRF token after a successful state-changing action.
        session["csrf_token"] = secrets.token_urlsafe(32)

        return jsonify(
            status="success",
            message="Transfer completed.",
            amount=str(amount),
        ), 200

    except Exception:
        conn.rollback()
        app.logger.exception("Transfer failed for user %s", user_id)
        return jsonify(error="Transfer could not be processed."), 500
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    app.run(ssl_context="adhoc")