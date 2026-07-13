from flask import Flask, request, jsonify, session
from functools import wraps
from decimal import Decimal, InvalidOperation
import sqlite3
import os
import secrets
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

DATABASE = os.environ.get("DATABASE_PATH", "app.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                balance TEXT NOT NULL DEFAULT '0.00'
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_account_id INTEGER NOT NULL,
                to_account_id INTEGER NOT NULL,
                amount TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        db.commit()


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "authentication required"}), 401
        return f(*args, **kwargs)

    return wrapper


def parse_money(value):
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError):
        return None
    if amount <= 0:
        return None
    return amount


@app.route("/transfer", methods=["POST"])
@login_required
def transfer_funds():
    from_account_id = request.form.get("from_account_id", type=int)
    to_account_id = request.form.get("to_account_id", type=int)
    amount = parse_money(request.form.get("amount"))

    if not from_account_id or not to_account_id or amount is None:
        return jsonify({"error": "invalid transfer request"}), 400

    if from_account_id == to_account_id:
        return jsonify({"error": "source and destination accounts must differ"}), 400

    user_id = session["user_id"]

    try:
        with get_db() as db:
            db.execute("BEGIN IMMEDIATE")

            from_acct = db.execute(
                "SELECT id, user_id, balance FROM accounts WHERE id = ?",
                (from_account_id,),
            ).fetchone()
            to_acct = db.execute(
                "SELECT id, user_id, balance FROM accounts WHERE id = ?",
                (to_account_id,),
            ).fetchone()

            if from_acct is None or to_acct is None:
                db.execute("ROLLBACK")
                return jsonify({"error": "account not found"}), 404

            if from_acct["user_id"] != user_id:
                db.execute("ROLLBACK")
                return jsonify({"error": "not authorized for source account"}), 403

            from_balance = Decimal(from_acct["balance"])
            to_balance = Decimal(to_acct["balance"])

            if from_balance < amount:
                db.execute("ROLLBACK")
                return jsonify({"error": "insufficient funds"}), 400

            new_from_balance = (from_balance - amount).quantize(Decimal("0.01"))
            new_to_balance = (to_balance + amount).quantize(Decimal("0.01"))

            db.execute(
                "UPDATE accounts SET balance = ? WHERE id = ?",
                (str(new_from_balance), from_account_id),
            )
            db.execute(
                "UPDATE accounts SET balance = ? WHERE id = ?",
                (str(new_to_balance), to_account_id),
            )
            db.execute(
                """
                INSERT INTO transfers (from_account_id, to_account_id, amount, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    from_account_id,
                    to_account_id,
                    str(amount),
                    datetime.utcnow().isoformat(timespec="seconds") + "Z",
                ),
            )
            db.commit()

        return jsonify(
            {
                "message": "transfer completed",
                "from_account_id": from_account_id,
                "to_account_id": to_account_id,
                "amount": str(amount),
            }
        ), 200

    except sqlite3.Error:
        return jsonify({"error": "database error"}), 500


if __name__ == "__main__":
    init_db()
    app.run(debug=True)