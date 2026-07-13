```python
from flask import Flask, render_template_string, request, jsonify
import secrets
import hashlib
import datetime

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Content Security Policy nonce generation
def generate_nonce():
    return secrets.token_urlsafe(32)

# HTML template with inline scripts protected by CSP nonce
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask Secure Inline Script Page</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e0e0e0;
        }
        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px;
            max-width: 700px;
            width: 90%;
            box-shadow: 0 25px 45px rgba(0, 0, 0, 0.5);
        }
        h1 {
            text-align: center;
            font-size: 2rem;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #00d2ff, #a200ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            text-align: center;
            color: #888;
            margin-bottom: 30px;
            font-size: 0.9rem;
        }
        .info-box {
            background: rgba(0, 210, 255, 0.05);
            border: 1px solid rgba(0, 210, 255, 0.2);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .info-box h3 {
            color: #00d2ff;
            margin-bottom: 10px;
            font-size: 1rem;
        }
        .server-data {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 0.85rem;
        }
        .data-item {
            background: rgba(255, 255, 255, 0.03);
            padding: 8px 12px;
            border-radius: 6px;
            border-left: 3px solid #00d2ff;
        }
        .data-item span {
            color: #888;
            display: block;
            font-size: 0.75rem;
        }
        .interactive-section {
            margin-top: 20px;
        }
        .input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        input[type="text"], input[type="number"] {
            flex: 1;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.07);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: #e0e0e0;
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.3s;
        }
        input[type="text"]:focus, input[type="number"]:focus {
            border-color: #00d2ff;
        }
        input[type="text"]::placeholder, input[type="number"]::placeholder {
            color: #555;
        }
        button {
            padding: 12px 24px;
            background: linear-gradient(135deg, #00d2ff, #a200ff);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 0.9rem;
            cursor: pointer;
            transition: opacity 0.3s, transform 0.2s;
            white-space: nowrap;
        }
        button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        button:active {
            transform: translateY(0);
        }
        .output-box {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 15px;
            min-height: 60px;
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            color: #00d2ff;
            word-break: break-all;
        }
        .clock-display {
            text-align: center;
            font-size: 2.5rem;
            font-family: 'Courier New', monospace;
            color: #00d2ff;
            padding: 15px;
            letter-spacing: 4px;
        }
        .date-display {
            text-align: center;
            color: #888;
            font-size: 0.85rem;
            margin-bottom: 10px;
        }
        .counter-section {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin: 15px 0;
        }
        .counter-display {
            font-size: 2rem;
            font-weight: bold;
            color: #a200ff;
            min-width: 60px;
            text-align: center;
        }
        .counter-btn {
            padding: 10px 20px;
            font-size: 1.2rem;
        }
        .reset-btn {
            background: linear-gradient(135deg, #ff416c, #ff4b2b);
            padding: 8px 16px;
            font-size: 0.8rem;
        }
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00ff88;
            margin-right: 6px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        .tabs {
            display: flex;
            gap: 5px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .tab-btn {
            padding: 8px 16px;
            font-size: 0.8rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
        }
        .tab-btn.active {
            background: linear-gradient(135deg, #00d2ff, #a200ff);
            border-color: transparent;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .hash-result {
            margin-top: 10px;
            padding: 10px;
            background: rgba(162, 0, 255, 0.1);
            border: 1