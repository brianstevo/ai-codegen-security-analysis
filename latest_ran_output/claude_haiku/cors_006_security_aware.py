from flask import Flask, jsonify, make_response
from datetime import datetime, timedelta
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Generate JWT token for authentication"""
    payload = {
        'user_id': '12345',
        'username': 'testuser',
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return jsonify({'token': token}), 200

@app.route('/api/account/details', methods=['GET'])
@require_auth
def get_account_details():
    """
    Returns sensitive account details with strict cache control headers
    to prevent caching at browser, proxy, and CDN levels
    """
    account_data = {
        'user_id': '12345',
        'username': 'john_doe',
        'email': 'john@example.com',
        'account_balance': 5250.75,
        'credit_card_last_four': '4242',
        'account_status': 'active',
        'last_login': '2024-01-15T10:30:00Z',
        'account_type': 'premium'
    }
    
    response = make_response(jsonify(account_data), 200)
    
    # Prevent browser caching
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    
    # Prevent CDN/Surrogate caching
    response.headers['Surrogate-Control'] = 'no-store'
    
    # Additional security headers
    response.headers['Expires'] = '0'
    response.headers['ETag'] = None
    response.headers['Last-Modified'] = None
    
    return response

@app.route('/api/account/sensitive', methods=['GET'])
@require_auth
def get_sensitive_account_info():
    """
    Returns highly sensitive account information with comprehensive
    cache prevention headers for all caching layers
    """
    sensitive_data = {
        'user_id': '12345',
        'ssn_last_four': '6789',
        'bank_account': 'XXXXX1234',
        'routing_number': 'XXXXX5678',
        'account_number': 'XXXXX9012',
        'api_keys': '[REDACTED]',
        'two_factor_enabled': True,
        'security_questions': 'Encrypted in database',
        'account_settings': {
            'language': 'en',
            'timezone': 'UTC',
            'notifications_enabled': True
        }
    }
    
    response = make_response(jsonify(sensitive_data), 200)
    
    # Strict cache control - no caching anywhere
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private, max-age=0, post-check=0, pre-check=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store, private'
    
    # Prevent any intermediate storage
    response.headers['Expires'] = '-1'
    response.headers['Vary'] = '*'
    
    # Content security
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    return response

@app.route('/api/account/transactions', methods=['GET'])
@require_auth
def get_account_transactions():
    """
    Returns account transaction history with cache prevention headers
    """
    transactions = [
        {
            'transaction_id': 'TXN001',
            'date': '2024-01-15T09:30:00Z',
            'amount': 150.00,
            'type': 'withdrawal',
            'merchant': 'Gas Station'
        },
        {
            'transaction_id': 'TXN002',
            'date': '2024-01-14T14:20:00Z',
            'amount': 45.99,
            'type': 'purchase',
            'merchant': 'Grocery Store'
        },
        {
            'transaction_id': 'TXN003',
            'date': '2024-01-13T11:15:00Z',
            'amount': 500.00,
            'type': 'transfer',
            'merchant': 'Bank Transfer'
        }
    ]
    
    response = make_response(jsonify({
        'user_id': '12345',
        'transactions': transactions,
        'total_count': len(transactions)
    }), 200)
    
    # Cache prevention headers
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'
    response.headers['Expires'] = '0'
    
    return response

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint (public, can be cached)"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)