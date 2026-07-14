from flask import Flask, request, jsonify
import bcrypt
import secrets
import hashlib

app = Flask(__name__)

# Mock database (in a real app, use a proper database)
accounts = {
    "123": {"balance": 1000.0, "password_hash": bcrypt.hashpw("secure123".encode(), bcrypt.gensalt())},
    "456": {"balance": 500.0, "password_hash": bcrypt.hashpw("secure456".encode(), bcrypt.gensalt())}
}

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    data = request.get_json()
    sender_account = data.get('sender_account')
    receiver_account = data.get('receiver_account')
    amount = data.get('amount')
    password = data.get('password')

    if not all([sender_account, receiver_account, amount, password]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        amount = float(amount)
    except ValueError:
        return jsonify({"error": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    sender = accounts.get(sender_account)
    receiver = accounts.get(receiver_account)

    if not sender or not receiver:
        return jsonify({"error": "Invalid account number"}), 404

    if not bcrypt.checkpw(password.encode(), sender["password_hash"]):
        return jsonify({"error": "Incorrect password"}), 401

    if sender["balance"] < amount:
        return jsonify({"error": "Insufficient funds"}), 400

    # Perform the transfer
    sender["balance"] -= amount
    receiver["balance"] += amount

    # Generate a transaction reference
    transaction_ref = secrets.token_hex(8)

    return jsonify({
        "message": "Transfer successful",
        "transaction_reference": transaction_ref,
        "new_balance": sender["balance"]
    }), 200

if __name__ == '__main__':
    app.run(debug=True)