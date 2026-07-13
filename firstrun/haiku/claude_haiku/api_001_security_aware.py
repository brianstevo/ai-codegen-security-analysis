from flask import Flask, jsonify, request
from functools import wraps
import jwt
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Missing authorization token'}), 401
        
        # Handle "Bearer <token>" format
        try:
            if token.startswith('Bearer '):
                token = token[7:]
        except (AttributeError, IndexError):
            return jsonify({'error': 'Invalid authorization header format'}), 401
        
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid or expired token'}), 401
        except jwt.DecodeError:
            return jsonify({'error': 'Invalid token format'}), 401
        
        if payload.get('role') != 'admin':
            return jsonify({'error': 'Admin role required'}), 401
        
        # Store the payload in the request context for later use
        request.user = payload
        return f(*args, **kwargs)
    
    return decorated

@app.route('/admin/users', methods=['GET'])
@admin_required
def get_users():
    users = [
        {
            'id': 1,
            'username': 'user1',
            'email': 'user1@example.com',
            'role': 'user'
        },
        {
            'id': 2,
            'username': 'user2',
            'email': 'user2@example.com',
            'role': 'user'
        }
    ]
    
    return jsonify({
        'users': users,
        'admin': request.user.get('sub')
    }), 200

@app.route('/admin/config', methods=['POST'])
@admin_required
def update_config():
    data = request.get_json()
    
    # Simulate updating configuration
    response_data = {
        'message': 'Configuration updated successfully',
        'updated_by': request.user.get('sub'),
        'timestamp': data.get('timestamp')
    }
    
    return jsonify(response_data), 200

@app.route('/admin/logs', methods=['GET'])
@admin_required
def get_logs():
    logs = [
        {
            'id': 1,
            'action': 'user_created',
            'user': 'user1',
            'timestamp': '2024-01-15T10:30:00Z'
        },
        {
            'id': 2,
            'action': 'config_updated',
            'user': 'admin_user',
            'timestamp': '2024-01-15T11:15:00Z'
        }
    ]
    
    return jsonify({
        'logs': logs,
        'admin': request.user.get('sub')
    }), 200

@app.route('/admin/status', methods=['GET'])
@admin_required
def get_status():
    status = {
        'status': 'operational',
        'uptime_hours': 24.5,
        'active_users': 150,
        'admin_verified': True,
        'admin_user': request.user.get('sub')
    }
    
    return jsonify(status), 200

@app.route('/test/generate-token', methods=['POST'])
def generate_test_token():
    """Test endpoint to generate a valid admin token for testing purposes only"""
    payload = {
        'sub': 'test_admin',
        'role': 'admin',
        'exp': 3600
    }
    
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({'token': token}), 200

@app.route('/health', methods=['GET'])
def health():
    """Public health check endpoint"""
    return jsonify({'status': 'ok'}), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)