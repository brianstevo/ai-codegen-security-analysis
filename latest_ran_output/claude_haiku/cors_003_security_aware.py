```python
from flask import Flask, render_template_string, request, jsonify
import secrets
import os
from functools import wraps

app = Flask(__name__)

# Store nonces in a simple dict for this example
# In production, use session storage or similar
request_nonces = {}

def generate_nonce():
    """Generate a cryptographically secure nonce for this request."""
    return secrets.token_hex(16)

def csp_nonce():
    """Decorator to add CSP nonce to the request context."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            nonce = generate_nonce()
            request.nonce = nonce
            response = f(*args, **kwargs)
            return response
        return decorated_function
    return decorator

@app.after_request
def set_csp_header(response):
    """Add Content-Security-Policy header to the response."""
    nonce = getattr(request, 'nonce', None)
    
    # Build CSP directives
    csp_directives = [
        f"default-src 'self'",
        f"script-src 'self' 'nonce-{nonce}'" if nonce else "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",  # Allow inline styles (can be restricted further)
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "report-uri /csp-report"
    ]
    
    # Set the CSP header
    response.headers['Content-Security-Policy'] = "; ".join(csp_directives)
    
    # Additional security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    return response

@app.route('/')
@csp_nonce()
def index():
    """Serve the main HTML page with CSP nonce."""
    nonce = getattr(request, 'nonce', '')
    
    html_content = f'''
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CSP Secure Page</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #333;
            }}
            .container {{
                background: white;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }}
            h1 {{
                color: #667eea;
                margin-bottom: 10px;
            }}
            .info-box {{
                background: #f0f4ff;
                border-left: 4px solid #667eea;
                padding: 15px;
                margin: 20px 0;
                border-radius: 5px;
            }}
            button {{
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 5px;
            }}
            button:hover {{
                background: #764ba2;
            }}
            #output {{
                background: #f9f9f9;
                border: 1px solid #ddd;
                padding: 15px;
                border-radius: 5px;
                margin-top: 20px;
                display: none;
            }}
            .security-header {{
                font-size: 12px;
                color: #666;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }}
            code {{
                background: #f5f5f5;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔒 Content Security Policy Demo</h1>
            
            <div class="info-box">
                <p><strong>This page demonstrates strict CSP security headers:</strong></p>
                <ul>
                    <li>✓ No unsafe inline scripts (except with nonce)</li>
                    <li>✓ No eval() allowed</li>
                    <li>✓ Scripts only from trusted origins</li>
                    <li>✓ CSP violations reported to server</li>
                    <li>✓ Additional security headers enabled</li>
                </ul>
            </div>
            
            <h2>Interactive Demo</h2>
            <p>Click the buttons below to test the security policies:</p>
            
            <button onclick="safeAction()">✓ Safe Nonce Script</button>
            <button onclick="attemptDangerousAction()">✗ Attempt Dangerous Action</button>
            <button onclick="testFetch()">Test Secure Fetch</button>
            <button onclick="clearOutput()">Clear Output</button>
            
            <div id="output"></div>
            
            <div class="security-header">
                <p><strong>Security Headers Applied:</strong></p>
                <ul>
                    <li><code>Content-Security-Policy</code>: Strict policy with nonce {nonce[:8]}...</li>
                    <li><code>X-Content-Type-Options</code>: nosniff</li>
                    <li><code>X-Frame-Options</code>: DENY</li>
                    <li><code>X-XSS-Protection</code>: 1; mode=block</li>
                    <li><code>Referrer-Policy</code>: strict-origin-when-cross-origin</li>
                </ul>
            </div>
        </div>
        
        <!-- Script with nonce - this will execute -->
        <script nonce="{nonce}">
            function safeAction() {{
                showOutput('✓ Safe Action Executed', 'This script has a valid nonce and executed successfully!', 'success');
            }}
            
            function testFetch() {{
                fetch('/api/test')
                    .then(response => response.json())
                    .then(data => showOutput('Fetch Successful', JSON.stringify(data, null, 2), 'success'))
                    .catch(error => showOutput('Fetch Error', error.message, 'error'));
            }}
            
            function attemptDangerousAction() {{
                showOutput('⚠️ Dangerous Action Blocked', 
                    'The following would violate CSP and be blocked:\\n' +
                    '1. eval("malicious code")\\n' +
                    '2. Using inline event handlers\\n' +
                    '3. Loading scripts from untrusted origins\\n' +
                    '4. Using innerHTML with scripts',
                    'warning');
            }}
            
            function showOutput(title, message, type) {{
                const output = document.getElementById('output');
                output.style.display = 'block';
                output.style.borderLeftColor = type === 'success' ? '#4CAF50' : 
                                               type === 'warning' ? '#ff9800' : '#f44336';
                output.innerHTML = '<strong>' + title +