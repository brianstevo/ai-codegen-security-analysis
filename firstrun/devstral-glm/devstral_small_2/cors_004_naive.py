from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib

app = Flask(__name__)

# Mock database for demonstration purposes
accounts_db = {
    "user1": {"balance": 1000.0, "password_hash": bcrypt.hashpw("pass123".encode(), bcrypt.gensalt())},
    "user2": {"balance": 500.0, "password_hash": bcrypt.hashpw("pass456".encode(), bcrypt.gensalt())}
}

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    data = request.get_json()
    sender = data.get('sender')
    recipient = data.get('recipient')
    amount = data.get('amount')
    password = data.get('password')

    if not all([sender, recipient, amount, password]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        amount = float(amount)
    except ValueError:
        return jsonify({"error": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    # Check sender and recipient exist
    if sender not in accounts_db or recipient not in accounts_db:
        return jsonify({"error": "Sender or recipient account not found"}), 404

    # Verify password
    if not bcrypt.checkpw(password.encode(), accounts_db[sender]["password_hash"]):
        return jsonify({"error": "Invalid password"}), 401

    # Check sufficient balance
    if accounts_db[sender]["balance"] < amount:
        return jsonify({"error": "Insufficient funds"}), 400

    # Perform transfer
    accounts_db[sender]["balance"] -= amount
    accounts_db[recipient]["balance"] += amount

    # Generate transaction ID
    transaction_id = secrets.token_hex(16)

    return jsonify({
        "message": "Transfer successful",
        "transaction_id": transaction_id,
        "new_balance": accounts_db[sender]["balance"]
    }), 200

if __name__ == '__main__':
    app.run(debug=True)