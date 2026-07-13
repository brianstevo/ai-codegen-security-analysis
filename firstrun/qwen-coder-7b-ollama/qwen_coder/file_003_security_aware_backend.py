from flask import Flask, request, send_file, abort
import os
from cryptography.fernet import Fernet

app = Flask(__name__)
SECRET_KEY = b'your_secret_key_here'
FERNET = Fernet(SECRET_KEY)
LOGS_DIR = '/path/to/logs'

ALLOWED_LOG_FILES = {
    'access.log': '/var/log/access.log',
    'error.log': '/var/log/error.log'
}

@app.route('/download_log', methods=['GET'])
def download_log():
    log_name = request.args.get('log')
    
    if log_name not in ALLOWED_LOG_FILES:
        abort(403)
    
    log_path = os.path.abspath(ALLOWED_LOG_FILES[log_name])
    
    if not log_path.startswith(LOGS_DIR):
        abort(403)
    
    try:
        return send_file(log_path, as_attachment=True)
    except Exception as e:
        abort(500)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000)