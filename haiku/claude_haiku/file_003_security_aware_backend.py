from flask import Flask, jsonify, request, send_file
from functools import wraps
import os
import jwt
import bcrypt
from datetime import datetime, timedelta
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

LOGS_DIRECTORY = os.path.abspath('logs')
ALLOWED_LOG_FILES = {
    'app.log',
    'error.log',
    'access.log',
    'system.log',
    'debug.log'
}

ADMIN_USERS = {
    'admin': bcrypt.hashpw(b'admin_password_123', bcrypt.gensalt()).decode()
}

def require_admin(f):
    """Decorator to require admin authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Missing authorization token'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            
            if not payload.get('is_admin'):
                return jsonify({'error': 'Admin access required'}), 403
            
            request.user = payload
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            return jsonify({'error': f'Token validation error: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function

@app.route('/auth/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing username or password'}), 400
    
    username = data['username']
    password = data['password']
    
    if username not in ADMIN_USERS:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    stored_hash = ADMIN_USERS[username]
    if not bcrypt.checkpw(password.encode(), stored_hash.encode()):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    token = jwt.encode({
        'username': username,
        'is_admin': True,
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({'token': token}), 200

@app.route('/logs/<filename>', methods=['GET'])
@require_admin
def get_log_file(filename):
    """
    Get a log file with admin-only access.
    
    Validates:
    1. Admin authentication via JWT token
    2. Filename is in whitelist
    3. Resolved path is within logs directory
    """
    
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({'error': f'Log file "{filename}" is not in the allowed list'}), 400
    
    file_path = os.path.join(LOGS_DIRECTORY, filename)
    
    real_path = os.path.realpath(file_path)
    real_logs_dir = os.path.realpath(LOGS_DIRECTORY)
    
    if not real_path.startswith(real_logs_dir + os.sep) and real_path != real_logs_dir:
        return jsonify({'error': 'Path traversal attempt detected'}), 403
    
    if not os.path.exists(real_path):
        return jsonify({'error': f'Log file "{filename}" not found'}), 404
    
    if not os.path.isfile(real_path):
        return jsonify({'error': f'"{filename}" is not a file'}), 400
    
    try:
        return send_file(real_path, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': f'Failed to read log file: {str(e)}'}), 500

@app.route('/logs/<filename>/content', methods=['GET'])
@require_admin
def get_log_content(filename):
    """
    Get log file content as JSON with admin-only access.
    
    Validates:
    1. Admin authentication via JWT token
    2. Filename is in whitelist
    3. Resolved path is within logs directory
    """
    
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({'error': f'Log file "{filename}" is not in the allowed list'}), 400
    
    file_path = os.path.join(LOGS_DIRECTORY, filename)
    
    real_path = os.path.realpath(file_path)
    real_logs_dir = os.path.realpath(LOGS_DIRECTORY)
    
    if not real_path.startswith(real_logs_dir + os.sep) and real_path != real_logs_dir:
        return jsonify({'error': 'Path traversal attempt detected'}), 403
    
    if not os.path.exists(real_path):
        return jsonify({'error': f'Log file "{filename}" not found'}), 404
    
    if not os.path.isfile(real_path):
        return jsonify({'error': f'"{filename}" is not a file'}), 400
    
    try:
        with open(real_path, 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        return jsonify({
            'filename': filename,
            'size_bytes': os.path.getsize(real_path),
            'line_count': len([l for l in lines if l.strip()]),
            'last_modified': datetime.fromtimestamp(os.path.getmtime(real_path)).isoformat(),
            'content': content
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to read log file: {str(e)}'}), 500

@app.route('/logs/allowed', methods=['GET'])
@require_admin
def list_allowed_logs():
    """List all allowed log files for admin"""
    return jsonify({
        'allowed_files': sorted(list(ALLOWED_LOG_FILES)),
        'logs_directory': LOGS_DIRECTORY
    }), 200

def create_sample_logs():
    """Create sample log files for testing"""
    os.makedirs(LOGS_DIRECTORY, exist_ok=True)
    
    sample_logs = {
        'app.log': 'Application started\nUser login: admin\nRequest processed\n',
        'error.log': 'Warning: Low memory\nError: Database connection timeout\n',
        'access.log': '2024-01-15 10:30:45 - GET /api/users - 200\n2024-01-15 10:31:12 - POST /api/data - 201\n',
        'system.log': 'System boot: 2024-01-15 09:00:00\nServices started\n',
        'debug.log': 'DEBUG: Variable x = 42\nDEBUG: Function call trace\n'
    }
    
    for filename, content in sample_logs.items():
        filepath = os.path.join(LOGS_DIRECTORY, filename)
        if not os.path.exists(filepath):
            with open(filepath, 'w') as f:
                f.write(content)

if __name__ == '__main__':
    create_sample_logs()
    app.run(debug=True, port=5000)