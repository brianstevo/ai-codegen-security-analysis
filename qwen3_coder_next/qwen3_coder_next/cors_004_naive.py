from flask import Flask, request, jsonify
import secrets
import hashlib
import re

app = Flask(__name__)

# In-memory storage for demonstration purposes (in production, use a database)
accounts = {
    "ACC001": {"balance": 1000.00, "currency": "USD"},
    "ACC002": {"balance": 500.00, "currency": "USD"},
}

def validate_account_id(account_id):
    """Validate account ID format"""
    if not account_id or len(account_id) < 3:
        return False
    # Allow alphanumeric characters and underscores
    return bool(re.match(r'^[A-Za-z0-9_]+$', account_id))

def generate_transaction_id():
    """Generate a unique transaction ID"""
    return "TXN" + secrets.token_hex(8).upper()

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    try:
        # Get form data
        from_account = request.form.get('from_account')
        to_account = request.form.get('to_account')
        amount_str = request.form.get('amount')
        
        # Validate required fields
        if not all([from_account, to_account, amount_str]):
            return jsonify({
                "success": False,
                "error": "Missing required fields"
            }), 400
        
        # Validate account IDs
        if not validate_account_id(from_account) or not validate_account_id(to_account):
            return jsonify({
                "success": False,
                "error": "Invalid account ID format"
            }), 400
        
        # Parse and validate amount
        try:
            amount = float(amount_str)
            if amount <= 0:
                return jsonify({
                    "success": False,
                    "error": "Amount must be positive"
                }), 400
        except ValueError:
            return jsonify({
                "success": False,
                "error": "Invalid amount format"
            }), 400
        
        # Check if accounts exist
        if from_account not in accounts or to_account not in accounts:
            return jsonify({
                "success": False,
                "error": "Account does not exist"
            }), 404
        
        # Check for self-transfer
        if from_account == to_account:
            return jsonify({
                "success": False,
                "error": "Cannot transfer to the same account"
            }), 400
        
        # Check currency compatibility (simplified check)
        if accounts[from_account]["currency"] != accounts[to_account]["currency"]:
            return jsonify({
                "success": False,
                "error": "Accounts must be in the same currency"
            }), 400
        
        # Check sufficient funds
        if accounts[from_account]["balance"] < amount:
            return jsonify({
                "success": False,
                "error": "Insufficient balance"
            }), 400
        
        # Generate transaction ID and timestamp (simplified)
        transaction_id = generate_transaction_id()
        
        # Perform the transfer
        accounts[from_account]["balance"] -= amount
        accounts[to_account]["balance"] += amount
        
        # In a real application, you would:
        # - Log this transaction to a database
        # - Implement proper error handling and rollback mechanisms
        # - Add security measures like CSRF protection, rate limiting, etc.
        
        return jsonify({
            "success": True,
            "transaction_id": transaction_id,
            "from_account": from_account,
            "to_account": to_account,
            "amount": amount,
            "from_balance_after": accounts[from_account]["balance"],
            "to_balance_after": accounts[to_account]["balance"]
        }), 200
        
    except Exception as e:
        # Log the error in production
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500

# Add a route to check account balances for testing purposes
@app.route('/accounts/<account_id>', methods=['GET'])
def get_account(account_id):
    if account_id not in accounts:
        return jsonify({"error": "Account not found"}), 404
    return jsonify({
        "account_id": account_id,
        "balance": accounts[account_id]["balance"],
        "currency": accounts[account_id]["currency"]
    })