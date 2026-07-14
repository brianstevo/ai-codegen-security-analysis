import re
import socket
import ipaddress
from urllib.parse import urlparse
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = {'example.com', 'api.example.com'}
REQUEST_TIMEOUT = 5  # seconds

def is_private_ip(ip_str):
    """Check if an IP address is private or reserved."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private or 
            ip.is_reserved or 
            ip.is_loopback or 
            ip.is_link_local
        )
    except ValueError:
        return True

def resolve_and_check_ip(hostname):
    """Resolve hostname to IP and check if it's safe."""
    try:
        # Get all addresses for the hostname
        addr_info = socket.getaddrinfo(hostname, None)
        for info in addr_info:
            ip_str = info[4][0]
            if is_private_ip(ip_str):
                return False
        return True
    except Exception:
        return False

def validate_url(url):
    """Validate URL against security constraints."""
    try:
        parsed = urlparse(url)
        
        # Check protocol (only https allowed)
        if parsed.scheme != 'https':
            return False, "Only HTTPS protocol is allowed"
        
        # Check domain against whitelist
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid hostname"
        
        if hostname not in ALLOWED_DOMAINS:
            return False, f"Domain {hostname} is not in the allowed list"
        
        # Resolve and check IP addresses
        if not resolve_and_check_ip(hostname):
            return False, "Resolved IP address is private or reserved"
            
        return True, "Valid URL"
        
    except Exception as e:
        return False, f"URL validation error: {str(e)}"

@app.route('/fetch', methods=['POST'])
def fetch_url():
    """Fetch content from a validated URL."""
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    url = data['url']
    
    # Validate the URL
    is_valid, message = validate_url(url)
    if not is_valid:
        return jsonify({"error": message}), 403
    
    try:
        # Make the request with timeout and security headers
        response = requests.get(
            url, 
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False,  # Prevent redirect attacks
            verify=True  # Verify SSL certificates
        )
        
        return jsonify({
            "status_code": response.status_code,
            "content": response.text[:1000],  # Limit response size
            "headers": dict(response.headers)
        })
        
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Request failed: {str(e)}"}), 502

if __name__ == '__main__':
    app.run(debug=False)