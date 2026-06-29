from flask import Flask, request, jsonify, session
from functools import wraps
from decimal import Decimal, InvalidOperation
import secrets
import sqlite3
import hmac

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

DATABASE = "bank.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated


def generate_csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return session["csrf_token"]


def validate_csrf(token):
    expected = session.get("csrf_token")
    return expected is not None and token is not None and hmac.compare_digest(expected, token)


@app.route("/csrf-token", methods=["GET"])
@login_required
def csrf_token():
    return jsonify({"csrf_token": generate_csrf_token()})


@app.route("/transfer", methods=["POST"])
@login_required
def transfer_funds():
    # CSRF protection
    csrf = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token")
    if not validate_csrf(csrf):
        return jsonify({"error": "Invalid or missing CSRF token"}), 403

    user_id = session["user_id"]
    from_account = request.form.get("from_account", "").strip()
    to_account = request.form.get("to_account", "").strip()
    amount_raw = request.form.get("amount", "").strip()

    # Basic presence validation
    if not from_account or not to_account or not amount_raw:
        return jsonify({"error": "Missing required fields"}), 400

    if from_account == to_account:
        return jsonify({"error": "Cannot transfer to the same account"}), 400

    # Validate and normalize amount
    try:
        amount = Decimal(amount_raw).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return jsonify({"error": "Invalid amount format"}), 400

    if amount <= Decimal("0.00"):
        return jsonify({"error": "Amount must be positive"}), 400

    if amount > Decimal("1000000.00"):
        return jsonify({"error": "Amount exceeds transfer limit"}), 400

    conn = get_db()
    try:
        cur = conn.cursor()
        # Atomic transaction with row locking semantics
        cur.execute("BEGIN IMMEDIATE")

        # Verify ownership of source account
        cur.execute(
            "SELECT id, balance FROM accounts WHERE account_number = ? AND owner_id = ?",
            (from_account, user_id),
        )
        src = cur.fetchone()
        if src is None:
            conn.rollback()
            return jsonify({"error": "Source account not found or unauthorized"}), 403

        # Verify destination account exists
        cur.execute(
            "SELECT id FROM accounts WHERE account_number = ?",
            (to_account,),
        )
        dst = cur.fetchone()
        if dst is None:
            conn.rollback()
            return jsonify({"error": "Destination account not found"}), 404

        src_balance = Decimal(str(src["balance"])).quantize(Decimal("0.01"))
        if src_balance < amount:
            conn.rollback()
            return jsonify({"error": "Insufficient funds"}), 400

        # Perform the debit and credit
        cur.execute(
            "UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?",
            (str(amount), src["id"], str(amount)),
        )
        if cur.rowcount != 1:
            conn.rollback()
            return jsonify({"error": "Transfer failed due to balance change"}), 409

        cur.execute(
            "UPDATE accounts SET balance = balance + ? WHERE id = ?",
            (str(amount), dst["id"]),
        )

        # Record transaction ledger entry
        reference = secrets.token_hex(16)
        cur.execute(
            """INSERT INTO transactions
               (reference, from_account_id, to_account_id, amount, initiated_by)
               VALUES (?, ?, ?, ?, ?)""",
            (reference, src["id"], dst["id"], str(amount), user_id),
        )

        conn.commit()

        return jsonify({
            "status": "success",
            "reference": reference,
            "from_account": from_account,
            "to_account": to_account,
            "amount": str(amount),
        }), 200

    except sqlite3.Error:
        conn.rollback()
        return jsonify({"error": "Transaction processing error"}), 500
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(ssl_context="adhoc")