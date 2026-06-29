```python
from flask import Flask, render_template_string, request
import secrets
import os

app = Flask(__name__)

# Store trusted origins for script-src
TRUSTED_SCRIPT_ORIGINS = [
    "'self'",
    "https://cdn.jsdelivr.net",
]

@app.before_request
def add_security_headers():
    """Generate per-request nonce and add CSP header"""
    # Generate a secure nonce for this request
    nonce = secrets.token_hex(16)
    request.csp_nonce = nonce
    
    # Build CSP header with nonce
    trusted_origins_str = " ".join(TRUSTED_SCRIPT_ORIGINS)
    csp_header = (
        f"default-src 'self'; "
        f"script-src {trusted_origins_str} 'nonce-{nonce}'; "
        f"style-src 'self' 'unsafe-inline'; "
        f"img-src 'self' data: https:; "
        f"font-src 'self' data:; "
        f"connect-src 'self'; "
        f"frame-ancestors 'none'; "
        f"base-uri 'self'; "
        f"form-action 'self'; "
        f"report-uri /csp-report;"
    )
    request.environ['CSP_HEADER'] = csp_header

@app.after_request
def set_security_headers(response):
    """Apply CSP header to response"""
    if 'CSP_HEADER' in request.environ:
        response.headers['Content-Security-Policy'] = request.environ['CSP_HEADER']
    
    # Additional security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    
    return response

@app.route('/')
def index():
    """Serve HTML page with CSP nonce"""
    nonce = request.csp_nonce
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CSP Protected Page</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            
            .container {{
                background: white;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                padding: 40px;
                max-width: 600px;
                width: 100%;
            }}
            
            h1 {{
                color: #333;
                margin-bottom: 20px;
                font-size: 28px;
            }}
            
            .section {{
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid #eee;
            }}
            
            .section:last-child {{
                border-bottom: none;
            }}
            
            h2 {{
                color: #667eea;
                font-size: 18px;
                margin-bottom: 10px;
            }}
            
            p {{
                color: #666;
                line-height: 1.6;
                margin-bottom: 10px;
            }}
            
            code {{
                background: #f5f5f5;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                color: #d63384;
            }}
            
            .status {{
                display: inline-block;
                background: #d4edda;
                color: #155724;
                padding: 8px 12px;
                border-radius: 5px;
                margin-top: 10px;
            }}
            
            .warning {{
                background: #fff3cd;
                border: 1px solid #ffc107;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }}
            
            .success {{
                background: #d4edda;
                border: 1px solid #28a745;
                color: #155724;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }}
            
            button {{
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 10px;
                margin-top: 10px;
                transition: background 0.3s ease;
            }}
            
            button:hover {{
                background: #764ba2;
            }}
            
            .nonce-display {{
                background: #f8f9fa;
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                word-break: break-all;
                font-family: monospace;
                font-size: 12px;
            }}
            
            ul {{
                margin-left: 20px;
                color: #666;
            }}
            
            li {{
                margin-bottom: 8px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔒 Content Security Policy Protected</h1>
            
            <div class="section">
                <h2>Security Status</h2>
                <div class="success">
                    ✓ This page is protected with a strict Content Security Policy
                </div>
                <p>This page demonstrates proper CSP implementation with:</p>
                <ul>
                    <li>Per-request nonce for inline scripts</li>
                    <li>No 'unsafe-inline' or 'unsafe-eval'</li>
                    <li>Script restriction to trusted origins only</li>
                    <li>Comprehensive violation reporting</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>Current CSP Nonce</h2>
                <p>The nonce for this request is:</p>
                <div class="nonce-display">{nonce}</div>
                <p style="font-size: 12px; color: #999;">Each page refresh generates a new nonce</p>
            </div>
            
            <div class="section">
                <h2>Policy Details</h2>
                <ul>
                    <li><strong>script-src:</strong> 'self', trusted CDNs, + nonce</li>
                    <li><strong>style-src:</strong> 'self', inline styles allowed</li>
                    <li><strong>img-src:</strong> 'self', data URIs, HTTPS</li>
                    <li><strong>report-uri:</strong> /csp-report</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>Test Functionality</h2>
                <button onclick="testSecureScript()">Test Secure Script (Nonce)</button>