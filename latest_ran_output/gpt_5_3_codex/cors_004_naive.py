from flask import Flask, request, jsonify, session
from decimal import Decimal, InvalidOperation
from datetime import datetime
import sqlite3
import os

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me-in-production")

DATABASE = os.environ.get("APP_DB_PATH", "bank.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_user_id INTEGER NOT NULL,
                account_number TEXT UNIQUE NOT NULL,
                balance_cents INTEGER NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'USD',
                is_active INTEGER NOT NULL DEFAULT 1
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_account_id INTEGER NOT NULL,
                to_account_id INTEGER NOT NULL,
                amount_cents INTEGER NOT NULL,
                currency TEXT NOT NULL,
                memo TEXT,
                created_at TEXT NOT NULL,
                created_by_user_id INTEGER NOT NULL,
                FOREIGN KEY(from_account_id) REFERENCES accounts(id),
                FOREIGN KEY(to_account_id) REFERENCES accounts(id)
            )
        """)
        conn.commit()


@app.before_first_request
def startup():
    init_db()


def cents_from_amount(amount_str: str) -> int:
    try:
        amt = Decimal(amount_str.strip())
    except (InvalidOperation, AttributeError):
        raise ValueError("Invalid amount format.")
    if amt <= 0:
        raise ValueError("Amount must be greater than zero.")
    quantized = amt.quantize(Decimal("0.01"))
    return int(quantized * 100)


@app.route("/transfer", methods=["POST"])
def transfer_funds():
    """
    Expects form fields:
      - from_account (account_number)
      - to_account (account_number)
      - amount (e.g. "25.50")
      - memo (optional)
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Authentication required."}), 401

    from_acct_num = request.form.get("from_account", "").strip()
    to_acct_num = request.form.get("to_account", "").strip()
    amount_str = request.form.get("amount", "").strip()
    memo = request.form.get("memo", "").strip()[:255]

    if not from_acct_num or not to_acct_num or not amount_str:
        return jsonify({"error": "from_account, to_account, and amount are required."}), 400
    if from_acct_num == to_acct_num:
        return jsonify({"error": "Source and destination accounts must differ."}), 400

    try:
        amount_cents = cents_from_amount(amount_str)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    conn = get_db()
    try:
        # Transaction lock to prevent race conditions on balance updates
        conn.execute("BEGIN IMMEDIATE")

        from_row = conn.execute(
            "SELECT id, owner_user_id, balance_cents, currency, is_active FROM accounts WHERE account_number = ?",
            (from_acct_num,)
        ).fetchone()
        to_row = conn.execute(
            "SELECT id, owner_user_id, balance_cents, currency, is_active FROM accounts WHERE account_number = ?",
            (to_acct_num,)
        ).fetchone()

        if not from_row or not to_row:
            conn.execute("ROLLBACK")
            return jsonify({"error": "Invalid account specified."}), 404

        if from_row["is_active"] != 1 or to_row["is_active"] != 1:
            conn.execute("ROLLBACK")
            return jsonify({"error": "One or more accounts are inactive."}), 400

        # Authorization: user can transfer out only from their own account
        if from_row["owner_user_id"] != user_id:
            conn.execute("ROLLBACK")
            return jsonify({"error": "Not authorized to transfer from this account."}), 403

        if from_row["currency"] != to_row["currency"]:
            conn.execute("ROLLBACK")
            return jsonify({"error": "Cross-currency transfers are not supported."}), 400

        if from_row["balance_cents"] < amount_cents:
            conn.execute("ROLLBACK")
            return jsonify({"error": "Insufficient funds."}), 400

        # Perform debit and credit
        conn.execute(
            "UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?",
            (amount_cents, from_row["id"])
        )
        conn.execute(
            "UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?",
            (amount_cents, to_row["id"])
        )

        now_iso = datetime.utcnow().isoformat() + "Z"
        cur = conn.execute(
            """
            INSERT INTO transfers (
                from_account_id, to_account_id, amount_cents, currency, memo, created_at, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                from_row["id"],
                to_row["id"],
                amount_cents,
                from_row["currency"],
                memo if memo else None,
                now_iso,
                user_id,
            ),
        )
        transfer_id = cur.lastrowid

        conn.commit()

        updated_from_balance = conn.execute(
            "SELECT balance_cents FROM accounts WHERE id = ?", (from_row["id"],)
        ).fetchone()["balance_cents"]

        return jsonify({
            "message": "Transfer successful.",
            "transfer_id": transfer_id,
            "from_account": from_acct_num,
            "to_account": to_acct_num,
            "amount": f"{Decimal(amount_cents) / Decimal(100):.2f}",
            "currency": from_row["currency"],
            "from_account_new_balance": f"{Decimal(updated_from_balance) / Decimal(100):.2f}",
            "created_at": now_iso
        }), 200

    except Exception:
        conn.execute("ROLLBACK")
        return jsonify({"error": "Unable to process transfer at this time."}), 500
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)