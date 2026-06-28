from flask import Flask, request, jsonify
import secrets

app = Flask(__name__)

# Mock database for demonstration purposes
accounts_db = {
    "1001": {"balance": 5000.00},
    "1002": {"balance": 3000.00},
    "1003": {"balance": 1000.00}
}

# Mock authentication token store (in production, use a secure session or JWT)
valid_tokens = {
    "user1_token": "1001",
    "user2_token": "1002"
}

def authenticate(token):
    """Mock authentication function."""
    return valid_tokens.get(token)

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    # Get JSON data from request
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    amount = data.get('amount')
    auth_token = data.get('auth_token')
    
    # Validate inputs
    if not all([sender_id, receiver_id, amount, auth_token]):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Authenticate user
    authenticated_user_id = authenticate(auth_token)
    if not authenticated_user_id:
        return jsonify({"error": "Invalid authentication token"}), 401
    
    # Ensure the sender is the authenticated user (prevent unauthorized transfers)
    if authenticated_user_id != sender_id:
        return jsonify({"error": "Unauthorized transfer attempt"}), 403
    
    # Validate accounts exist
    if sender_id not in accounts_db or receiver_id not in accounts_db:
        return jsonify({"error": "Invalid account ID"}), 404
    
    # Validate amount
    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount format"}), 400
    
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400
    
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