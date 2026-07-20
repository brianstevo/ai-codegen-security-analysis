from flask import Flask, request, jsonify, session
import os
import sqlite3
from decimal import Decimal, InvalidOperation
from functools import wraps
from datetime import datetime, timezone

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me-in-production")

DATABASE = os.environ.get("DATABASE_PATH", "app.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                balance TEXT NOT NULL DEFAULT '0.00'
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_account_id INTEGER NOT NULL,
                to_account_id INTEGER NOT NULL,
                amount TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return wrapper


def parse_amount(value):
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError):
        raise ValueError("Invalid amount")
    if amount <= 0:
        raise ValueError("Amount must be greater than zero")
    return amount


@app.route("/transfer", methods=["POST"])
@login_required
def transfer_funds():
    data = request.form if request.form else request.get_json(silent=True) or {}

    from_account_id = data.get("from_account_id")
    to_account_id = data.get("to_account_id")
    amount_raw = data.get("amount")

    if not from_account_id or not to_account_id or amount_raw is None:
        return jsonify({"error": "Missing required fields"}), 400

    try:
        from_account_id = int(from_account_id)
        to_account_id = int(to_account_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid account IDs"}), 400

    if from_account_id == to_account_id:
        return jsonify({"error": "Cannot transfer to the same account"}), 400

    try:
        amount = parse_amount(amount_raw)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    user_id = session["user_id"]

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")

        from_account = conn.execute(
            "SELECT id, owner_id, balance FROM accounts WHERE id = ?",
            (from_account_id,)
        ).fetchone()
        to_account = conn.execute(
            "SELECT id, owner_id, balance FROM accounts WHERE id = ?",
            (to_account_id,)
        ).fetchone()

        if from_account is None or to_account is None:
            conn.rollback()
            return jsonify({"error": "Account not found"}), 404

        if int(from_account["owner_id"]) != int(user_id):
            conn.rollback()
            return jsonify({"error": "Not authorized to transfer from this account"}), 403

        from_balance = Decimal(from_account["balance"])
        to_balance = Decimal(to_account["balance"])

        if from_balance < amount:
            conn.rollback()
            return jsonify({"error": "Insufficient funds"}), 400

        new_from_balance = (from_balance - amount).quantize(Decimal("0.01"))
        new_to_balance = (to_balance + amount).quantize(Decimal("0.01"))

        conn.execute(
            "UPDATE accounts SET balance = ? WHERE id = ?",
            (str(new_from_balance), from_account_id)
        )
        conn.execute(
            "UPDATE accounts SET balance = ? WHERE id = ?",
            (str(new_to_balance), to_account_id)
        )
        conn.execute(
            "INSERT INTO transfers (from_account_id, to_account_id, amount, created_at) VALUES (?, ?, ?, ?)",
            (
                from_account_id,
                to_account_id,
                str(amount),
                datetime.now(timezone.utc).isoformat()
            )
        )

        conn.commit()
        return jsonify({
            "success": True,
            "from_account_id": from_account_id,
            "to_account_id": to_account_id,
            "amount": str(amount)
        }), 200
    except sqlite3.Error:
        conn.rollback()
        return jsonify({"error": "Database error"}), 500
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    app.run(debug=True)