```python
from flask import Flask, render_template_string, request, jsonify
import secrets
import hashlib
import hmac
import time

app = Flask(__name__)

# Secret key for the application
app.secret_key = secrets.token_hex(32)

# Generate a nonce for Content Security Policy
def generate_nonce():
    return secrets.token_urlsafe(16)

# Generate a simple CSRF token
def generate_csrf_token():
    timestamp = str(int(time.time()))
    secret = app.secret_key
    token_data = f"{timestamp}:{secrets.token_hex(16)}"
    signature = hmac.new(
        secret.encode(),
        token_data.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{token_data}:{signature}"

def validate_csrf_token(token):
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return False
        timestamp, random_part, signature = parts
        token_data = f"{timestamp}:{random_part}"
        expected_signature = hmac.new(
            app.secret_key.encode(),
            token_data.encode(),
            hashlib.sha256
        ).hexdigest()
        # Check signature validity and token age (max 1 hour)
        token_age = int(time.time()) - int(timestamp)
        return hmac.compare_digest(signature, expected_signature) and token_age < 3600
    except (ValueError, TypeError):
        return False

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask Inline Script Example</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e0e0e0;
        }

        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            width: 90%;
            max-width: 700px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #00d2ff, #7b2ff7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            color: #a0a0b0;
            margin-bottom: 30px;
            font-size: 0.95rem;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: #c0c0d0;
            font-size: 0.9rem;
            font-weight: 500;
        }

        input[type="text"],
        input[type="number"],
        textarea {
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            color: #e0e0e0;
            font-size: 1rem;
            transition: all 0.3s ease;
            outline: none;
        }

        input[type="text"]:focus,
        input[type="number"]:focus,
        textarea:focus {
            border-color: #00d2ff;
            background: rgba(0, 210, 255, 0.05);
            box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.1);
        }

        textarea {
            resize: vertical;
            min-height: 100px;
        }

        .btn {
            padding: 12px 28px;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-right: 10px;
            margin-bottom: 10px;
        }

        .btn-primary {
            background: linear-gradient(45deg, #00d2ff, #7b2ff7);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 210, 255, 0.3);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #e0e0e0;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }

        .btn-danger {
            background: linear-gradient(45deg, #ff416c, #ff4b2b);
            color: white;
        }

        .btn-danger:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 65, 108, 0.3);
        }

        .result-box {
            margin-top: 20px;
            padding: 16px;
            background: rgba(0, 210, 255, 0.05);
            border: 1px solid rgba(0, 210, 255, 0.2);
            border-radius: 10px;
            min-height: 60px;
            font-family: monospace;
            font-size: 0.95rem;
            white-space: pre-wrap;
            word-break: break-all;
            display: none;
        }

        .result-box.visible {
            display: block;
        }

        .result-box.error {
            border-color: rgba(255, 65, 108, 0.4);
            background: rgba(255, 65, 108, 0.05);
            color: #ff6b8a;
        }

        .result-box.success {
            border-color: rgba(0, 255, 128, 0.4);
            background: rgba(0, 255, 128, 0.05);
            color: #00e676;
        }

        .divider {
            border: none;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin: 30px 0;
        }

        .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #c0c0d0;
            margin-bottom: 20px;
        }

        .hash-display {
            font-size: 0.8rem;
            word-break: break-all;
        }

        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
            background-color: #4caf50;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }