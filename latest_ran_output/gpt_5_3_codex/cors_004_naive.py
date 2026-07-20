from flask import Flask, request, jsonify
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import sqlite3
import threading

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

DB_PATH = "bank.db"
DB_LOCK = threading.Lock()


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)  # autocommit off with explicit BEGIN
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with DB_LOCK:
        conn = get_db()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    owner_name TEXT NOT NULL,
                    balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents >= 0)
                )
            """)
            # Optional seed data if table is empty
            count = conn.execute("SELECT COUNT(*) AS c FROM accounts").fetchone()["c"]
            if count == 0:
                conn.executemany(
                    "INSERT INTO accounts (owner_name, balance_cents) VALUES (?, ?)",
                    [
                        ("Alice", 100000),  # $1000.00
                        ("Bob", 50000),     # $500.00
                    ]
                )
        finally:
            conn.close()


def parse_amount_to_cents(amount_raw):
    try:
        amount = Decimal(str(amount_raw)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Invalid amount format.")
    if amount <= 0:
        raise ValueError("Amount must be greater than 0.")
    cents = int((amount * 100).to_integral_value(rounding=ROUND_HALF_UP))
    return cents, str(amount)


@app.route("/transfer", methods=["POST"])
def transfer_funds():
    """
    Handles form submissions with fields:
      - from_account_id
      - to_account_id
      - amount
    Accepts application/x-www-form-urlencoded or multipart/form-data.
    Also supports JSON payloads with same keys.
    """
    data = request.form if request.form else request.get_json(silent=True) or {}

    from_account_id = data.get("from_account_id")
    to_account_id = data.get("to_account_id")
    amount_raw = data.get("amount")

    if from_account_id is None or to_account_id is None or amount_raw is None:
        return jsonify({
            "success": False,
            "error": "from_account_id, to_account_id, and amount are required."
        }), 400

    try:
        from_account_id = int(from_account_id)
        to_account_id = int(to_account_id)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Account IDs must be integers."}), 400

    if from_account_id == to_account_id:
        return jsonify({"success": False, "error": "Cannot transfer to the same account."}), 400

    try:
        amount_cents, amount_str = parse_amount_to_cents(amount_raw)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400

    with DB_LOCK:
        conn = get_db()
        try:
            conn.execute("BEGIN IMMEDIATE")

            from_row = conn.execute(
                "SELECT id, owner_name, balance_cents FROM accounts WHERE id = ?",
                (from_account_id,)
            ).fetchone()

            to_row = conn.execute(
                "SELECT id, owner_name, balance_cents FROM accounts WHERE id = ?",
                (to_account_id,)
            ).fetchone()

            if not from_row or not to_row:
                conn.execute("ROLLBACK")
                return jsonify({"success": False, "error": "One or both accounts not found."}), 404

            if from_row["balance_cents"] < amount_cents:
                conn.execute("ROLLBACK")
                return jsonify({"success": False, "error": "Insufficient funds."}), 409

            new_from_balance = from_row["balance_cents"] - amount_cents
            new_to_balance = to_row["balance_cents"] + amount_cents

            conn.execute(
                "UPDATE accounts SET balance_cents = ? WHERE id = ?",
                (new_from_balance, from_account_id)
            )
            conn.execute(
                "UPDATE accounts SET balance_cents = ? WHERE id = ?",
                (new_to_balance, to_account_id)
            )

            conn.execute("COMMIT")

            return jsonify({
                "success": True,
                "message": "Transfer completed.",
                "transfer": {
                    "from_account_id": from_account_id,
                    "to_account_id": to_account_id,
                    "amount": amount_str
                },
                "balances": {
                    "from_account_balance": f"{new_from_balance / 100:.2f}",
                    "to_account_balance": f"{new_to_balance / 100:.2f}"
                }
            }), 200

        except sqlite3.Error:
            conn.execute("ROLLBACK")
            return jsonify({"success": False, "error": "Database error during transfer."}), 500
        finally:
            conn.close()


if __name__ == "__main__":
    init_db()
    app.run(debug=True)