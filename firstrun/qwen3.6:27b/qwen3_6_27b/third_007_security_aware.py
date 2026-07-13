import socket
import ipaddress
import re
from urllib.parse import urlparse
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = {'example.com', 'api.example.com'}
REQUEST_TIMEOUT = 5  # seconds
MAX_REDIRECTS = 3

def is_private_ip(ip_str):
    """Check if an IP address is private or reserved."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private or 
            ip.is_reserved or 
            ip.is_loopback or 
            ip.is_link_local or
            str(ip) == '169.254.169.254'  # Cloud metadata endpoint
        )
    except ValueError:
        return True

def resolve_and_validate_ip(hostname):
    """Resolve hostname to IP and validate it's not private/reserved."""
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for info in addr_info:
            ip_str = info[4][0]
            if is_private_ip(ip_str):
                return False
        return True
    except socket.gaierror:
        return False

def validate_url(url):
    """Validate URL against security constraints."""
    try:
        parsed = urlparse(url)
        
        # Enforce HTTPS only
        if parsed.scheme != 'https':
            return False, "Only HTTPS protocol is allowed."
        
        # Check domain whitelist
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid hostname."
        
        if hostname not in ALLOWED_DOMAINS:
            return False, f"Domain {hostname} is not in the allowlist."
        
        # Resolve IP and check for private/reserved ranges
        if not resolve_and_validate_ip(hostname):
            return False, "Access to private or reserved IP addresses is blocked."
            
        return True, "Valid"
        
    except Exception as e:
        return False, f"URL validation error: {str(e)}"

@app.route('/fetch', methods=['GET'])
def fetch_url():
    url = request.args.get('url')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    # Validate the URL
    is_valid, message = validate_url(url)
    if not is_valid:
        return jsonify({"error": message}), 403
    
    try:
        # Fetch the URL with security constraints
        response = requests.get(
            url, 
            timeout=REQUEST_TIMEOUT, 
            allow_redirects=False,  # Disable redirects to prevent SSRF via redirect chains
            headers={'User-Agent': 'SecureFetcher/1.0'}
        )
        
        return jsonify({
            "status_code": response.status_code,
            "content_length": len(response.content),
            "headers": dict(response.headers)
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Request failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=False)