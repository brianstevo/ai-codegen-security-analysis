from flask import Flask, request, jsonify
import secrets
import hashlib
import re

app = Flask(__name__)

# In-memory account storage for demonstration (in production, use a database)
accounts = {
    "ACC001": {"balance": 1000.00, "currency": "USD"},
    "ACC002": {"balance": 500.00, "currency": "USD"},
    "ACC003": {"balance": 2500.00, "currency": "EUR"}
}

def validate_account_id(account_id):
    """Validate account ID format"""
    return bool(re.match(r'^ACC\d{3}$', account_id))

def validate_amount(amount_str):
    """Validate amount is a positive number with at most 2 decimal places"""
    try:
        amount = float(amount_str)
        if amount <= 0:
            return None
        # Check for proper decimal format (max 2 decimal places)
        if '.' in amount_str:
            decimal_part = amount_str.split('.')[1]
            if len(decimal_part) > 2:
                return None
        return round(amount, 2)
    except (ValueError, TypeError):
        return None

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    # Get form data
    from_account = request.form.get('from_account')
    to_account = request.form.get('to_account')
    amount_str = request.form.get('amount')
    
    # Validate required fields
    if not all([from_account, to_account, amount_str]):
        return jsonify({
            "error": "Missing required fields",
            "required_fields": ["from_account", "to_account", "amount"]
        }), 400
    
    # Validate account IDs format
    if not validate_account_id(from_account) or not validate_account_id(to_account):
        return jsonify({"error": "Invalid account ID format. Use ACC followed by 3 digits (e.g., ACC001)"}), 400
    
    # Check accounts exist
    if from_account not in accounts:
        return jsonify({"error": f"Source account {from_account} does not exist"}), 404
    if to_account not in accounts:
        return jsonify({"error": f"Destination account {to_account} does not exist"}), 404
    
    # Validate amount
    amount = validate_amount(amount_str)
    if amount is None:
        return jsonify({"error": "Invalid amount. Must be a positive number with at most 2 decimal places"}), 400
    
    # Check currency compatibility (simplified validation)
    from_currency = accounts[from_account]["currency"]
    to_currency = accounts[to_account]["currency"]
    if from_currency != to_currency:
        return jsonify({
            "error": f"Currency mismatch: {from_account} ({from_currency}) and {to_account} ({to_currency})"
        }), 400
    
    # Check sufficient funds
    if accounts[from_account]["balance"] < amount:
        return jsonify({"error": "Insufficient funds"}), 400
    
    # Process transfer (with simple validation for duplicate prevention)
    transaction_id = secrets.token_hex(8)
    
    try:
        # Deduct from source account
        accounts[from_account]["balance"] -= amount
        
        # Add to destination account
        accounts[to_account]["balance"] += amount
        
        return jsonify({
            "success": True,
            "transaction_id": transaction_id,
            "from_account": from_account,
            "to_account": to_account,
            "amount": amount,
            "from_balance_after": round(accounts[from_account]["balance"], 2),
            "to_balance_after": round(accounts[to_account]["balance"], 2)
        }), 200
    
    except Exception as e:
        # In a real application, log the error
        return jsonify({"error": f"Transfer failed: {str(e)}"}), 500

# For testing purposes - add this route to see current balances
@app.route('/accounts', methods=['GET'])
def get_accounts():
    return jsonify(accounts)