```python
from flask import Flask, render_template_string, request, jsonify, redirect, url_for, session
from flask_cors import CORS
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from cryptography.fernet import Fernet
import os
import secrets
from datetime import datetime, timedelta
import json

app = Flask(__name__)
CORS(app)

# Configuration
app.secret_key = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', 'YOUR_GOOGLE_CLIENT_SECRET')

# Session encryption
cipher_suite = Fernet(Fernet.generate_key())

# In-memory user store (in production, use a database)
users_db = {}
auth_tokens = {}


def encrypt_token(token_data):
    """Encrypt token data for secure storage"""
    token_string = json.dumps(token_data)
    encrypted = cipher_suite.encrypt(token_string.encode())
    return encrypted.decode()


def decrypt_token(encrypted_token):
    """Decrypt token data"""
    try:
        decrypted = cipher_suite.decrypt(encrypted_token.encode())
        return json.loads(decrypted.decode())
    except Exception:
        return None


def create_session_token(user_id, user_email):
    """Create a secure session token"""
    token_id = secrets.token_urlsafe(32)
    token_data = {
        'user_id': user_id,
        'email': user_email,
        'created_at': datetime.utcnow().isoformat(),
        'expires_at': (datetime.utcnow() + timedelta(hours=24)).isoformat()
    }
    auth_tokens[token_id] = token_data
    return token_id


def verify_session_token(token_id):
    """Verify and retrieve session token"""
    if token_id not in auth_tokens:
        return None
    
    token_data = auth_tokens[token_id]
    expires_at = datetime.fromisoformat(token_data['expires_at'])
    
    if datetime.utcnow() > expires_at:
        del auth_tokens[token_id]
        return None
    
    return token_data


def store_user(user_id, user_email, user_name, picture_url):
    """Store or update user in database"""
    users_db[user_id] = {
        'email': user_email,
        'name': user_name,
        'picture': picture_url,
        'created_at': datetime.utcnow().isoformat() if user_id not in users_db else users_db[user_id].get('created_at'),
        'last_login': datetime.utcnow().isoformat()
    }
    return users_db[user_id]


# HTML Template for the login page
LOGIN_PAGE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google OAuth Login</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            text-align: center;
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .google-btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        .google-btn:hover {
            background: #f8f8f8;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .google-logo {
            width: 20px;
            height: 20px;
        }
    </style>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
    <div class="login-container">
        <h1>Welcome</h1>
        <div id="g_id_onload"
             data-client_id="{{ google_client_id }}"
             data-callback="handleCredentialResponse">
        </div>
        <div class="g_id_signin" data-type="standard" data-size="large" data-theme="outline"></div>
    </div>

    <script>
        function handleCredentialResponse(response) {
            // Send the token to your backend
            fetch('/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: response.credential
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Store token in localStorage or cookie
                    localStorage.setItem('auth_token', data.auth_token);
                    // Redirect to dashboard or home
                    window.location.href = '/dashboard';
                } else {
                    alert('Login failed: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during login');
            });
        }

        window.onload = function () {
            google.accounts.id.initialize({
                client_id: '{{ google_client_id }}',
                callback: handleCredentialResponse
            });
        };
    </script>
</body>
</html>
'''

DASHBOARD_PAGE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .dashboard-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .user-info {
            display: grid;
            gap: 20px;
            margin-bottom: 30px;
        }
        .info-item {
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
        }
        .info-label {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .info-value {
            color: #333;
        }
        .logout-btn {
            padding: 12px 24px;
            background: #667eea;
            color: white