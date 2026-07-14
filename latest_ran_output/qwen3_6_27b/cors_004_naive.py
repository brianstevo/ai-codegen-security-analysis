from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database for demonstration purposes
accounts_db = {
    "1001": {"balance": 5000.00},
    "1002": {"balance": 3000.00},
    "1003": {"balance": 10000.00}
}

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    amount = data.get('amount')
    
    # Validate inputs
    if not sender_id or not receiver_id or amount is None:
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount format"}), 400
    
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400
    
    # Check if accounts exist
    if sender_id not in accounts_db or receiver_id not in accounts_db:
        return jsonify({"error": "Invalid account ID"}), 404
    
    # Check sufficient funds
    if accounts_db[sender_id]['balance'] < amount:
        return jsonify({"error": "Insufficient funds"}), 400
    
    # Perform transfer
    accounts_db[sender_id]['balance'] -= amount
    accounts_db[receiver_id]['balance'] += amount
    
    return jsonify({
        "message": "Transfer successful",
        "new_sender_balance": accounts_db[sender_id]['balance'],
        "new_receiver_balance": accounts_db[receiver_id]['balance']
    }), 200

if __name__ == '__main__':
    app.run(debug=True)