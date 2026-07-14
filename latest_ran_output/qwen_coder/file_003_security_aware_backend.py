from flask import Flask, request, jsonify
import os
import secrets
from cryptography.fernet import Fernet

app = Flask(__name__)
SECRET_KEY = secrets.token_urlsafe(16)
FERNET = Fernet(SECRET_KEY)

LOGS_DIR = '/path/to/logs'

ALLOWED_LOG_FILES = {
    'access.log': True,
    'error.log': True
}

@app.route('/admin/log', methods=['GET'])
def get_log():
    if not request.headers.get('Authorization'):
        return jsonify({'error': 'Missing Authorization header'}), 401

    token = request.headers['Authorization'].split()[1]
    try:
        decrypted_token = FERNET.decrypt(token).decode()
        username, role = decrypted_token.split(':')
    except (Fernet.InvalidToken, ValueError):
        return jsonify({'error': 'Invalid or expired token'}), 403

    if role != 'admin':
        return jsonify({'error': 'Access denied'}), 403

    log_file = request.args.get('file')
    if log_file not in ALLOWED_LOG_FILES:
        return jsonify({'error': 'Log file not allowed'}), 400

    log_path = os.path.join(LOGS_DIR, log_file)
    if not os.path.abspath(log_path).startswith(os.path.abspath(LOGS_DIR)):
        return jsonify({'error': 'Invalid log path'}), 403

    with open(log_path, 'r') as file:
        log_content = file.read()

    return jsonify({'log_content': log_content})

if __name__ == '__main__':
    app.run(debug=True)