from flask import Flask, jsonify, make_response
from datetime import datetime
import secrets

app = Flask(__name__)

# Simulated user database (in production, use a real database)
users = {
    "user123": {
        "id": "user123",
        "email": "user@example.com",
        "username": "john_doe",
        "account_balance": 5000.50,
        "credit_card_last_four": "4242",
        "account_status": "active",
        "created_at": "2023-01-15"
    }
}

# Simulated authentication token (in production, use proper JWT validation)
valid_tokens = {
    "test_token_" + secrets.token_hex(16): "user123"
}


@app.route('/api/account/details', methods=['GET'])
def get_account_details():
    """
    Returns sensitive account details with strict caching headers.
    Includes Cache-Control, Pragma, and Surrogate-Control headers
    to prevent caching in browsers, proxies, and CDNs.
    """
    # In production, verify the authorization header properly
    auth_header = app.config.get('CURRENT_AUTH_TOKEN', 'test_token_' + list(valid_tokens.keys())[0] if valid_tokens else '')
    
    if not auth_header or auth_header not in valid_tokens:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = valid_tokens.get(auth_header)
    if not user_id or user_id not in users:
        return jsonify({"error": "User not found"}), 404
    
    user_data = users[user_id]
    
    response = make_response(jsonify({
        "success": True,
        "data": {
            "id": user_data["id"],
            "email": user_data["email"],
            "username": user_data["username"],
            "account_balance": user_data["account_balance"],
            "credit_card_last_four": user_data["credit_card_last_four"],
            "account_status": user_data["account_status"],
            "created_at": user_data["created_at"],
            "timestamp": datetime.utcnow().isoformat()
        }
    }), 200)
    
    # Prevent storage in browser cache
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    
    # Additional cache prevention headers for HTTP/1.0 compatibility
    response.headers['Pragma'] = 'no-cache'
    
    # Prevent caching at CDN/proxy layers
    response.headers['Surrogate-Control'] = 'no-store'
    
    # Additional security headers for sensitive data
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Ensure the response is sent with proper content type
    response.headers['Content-Type'] = 'application/json'
    
    return response


@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """
    Returns transaction history with the same strict caching headers
    as they contain sensitive financial information.
    """
    auth_header = app.config.get('CURRENT_AUTH_TOKEN', 'test_token_' + list(valid_tokens.keys())[0] if valid_tokens else '')
    
    if not auth_header or auth_header not in valid_tokens:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = valid_tokens.get(auth_header)
    
    # Mock transaction data
    transactions = [
        {
            "id": "txn_001",
            "amount": 50.00,
            "type": "purchase",
            "merchant": "Amazon",
            "date": "2024-01-15",
            "status": "completed"
        },
        {
            "id": "txn_002",
            "amount": 100.00,
            "type": "transfer",
            "recipient": "John Smith",
            "date": "2024-01-14",
            "status": "completed"
        },
        {
            "id": "txn_003",
            "amount": 25.50,
            "type": "purchase",
            "merchant": "Starbucks",
            "date": "2024-01-13",
            "status": "completed"
        }
    ]
    
    response = make_response(jsonify({
        "success": True,
        "user_id": user_id,
        "transactions": transactions,
        "count": len(transactions)
    }), 200)
    
    # Strict caching prevention for sensitive transaction data
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'
    
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    
    return response


@app.route('/api/settings', methods=['GET'])
def get_settings():
    """
    Returns user settings with sensitive data protected by caching headers.
    """
    auth_header = app.config.get('CURRENT_AUTH_TOKEN', 'test_token_' + list(valid_tokens.keys())[0] if valid_tokens else '')
    
    if not auth_header or auth_header not in valid_tokens:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = valid_tokens.get(auth_header)
    
    settings = {
        "notifications": {
            "email": True,
            "sms": True,
            "push": False
        },
        "privacy": {
            "profile_visible": "friends_only",
            "show_balance": False
        },
        "security": {
            "two_factor_enabled": True,
            "last_login": "2024-01-15T10:30:00Z",
            "active_sessions": 1
        }
    }
    
    response = make_response(jsonify({
        "success": True,
        "user_id": user_id,
        "settings": settings
    }), 200)
    
    # Cache prevention headers
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'
    
    # Additional security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    
    return response


@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint that doesn't contain sensitive data.
    This endpoint can have normal caching headers.
    """
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }), 200


@app.before_request
def setup_test_auth():
    """Setup test authentication for demonstration purposes."""
    if not valid_tokens:
        # Add a test token if none exist
        valid_tokens["test_token_abc123def456"] = "user123"
    app.config['CURRENT_AUTH_TOKEN'] = list(valid_tokens.keys())[0] if valid_tokens else None


if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)