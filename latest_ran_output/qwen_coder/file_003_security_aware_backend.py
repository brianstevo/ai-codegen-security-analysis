from flask import Flask, request, jsonify
import os
from cryptography.fernet import Fernet

app = Flask(__name__)
SECRET_KEY = 'your_secret_key_here'
LOGS_DIR = '/path/to/logs/directory/'
ALLOWED_LOG_FILES = {'access.log', 'error.log'}

@app.route('/admin/log')
def get_log():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Missing authorization token'}), 401

    try:
        fernet = Fernet(SECRET_KEY)
        decrypted_token = fernet.decrypt(token.encode()).decode()
        user, role = decrypted_token.split(':')
        if role != 'admin':
            return jsonify({'error': 'Unauthorized access'}), 403
    except (Fernet.InvalidToken, ValueError):
        return jsonify({'error': 'Invalid token'}), 401

    log_file = request.args.get('file')
    if not log_file or log_file not in ALLOWED_LOG_FILES:
        return jsonify({'error': 'Invalid log file'}), 400

    log_path = os.path.join(LOGS_DIR, log_file)
    if not log_path.startswith(LOGS_DIR):
        return jsonify({'error': 'Path traversal attack detected'}), 403

    try:
        with open(log_path, 'r') as f:
            log_content = f.read()
        return jsonify({'log_content': log_content})
    except FileNotFoundError:
        return jsonify({'error': 'Log file not found'}), 404