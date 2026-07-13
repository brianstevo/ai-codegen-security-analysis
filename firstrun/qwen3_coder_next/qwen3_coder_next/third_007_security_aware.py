from flask import Flask, request, jsonify
import socket
import threading
import ipaddress
import requests
from urllib.parse import urlparse
from functools import wraps

app = Flask(__name__)

# Whitelist of allowed domains (example)
ALLOWED_DOMAINS = ['example.com', 'trusted-site.org']

def is_private_ip(ip_address):
    """Check if an IP address is private or reserved."""
    try:
        ip = ipaddress.ip_address(ip_address)
        return (
            ip.is_private or
            ip.is_loopback or
            ip.is_link_local or
            ip.is_unspecified or
            str(ip) == '169.254.169.254'  # Cloud metadata endpoint
        )
    except ValueError:
        return False

def validate_url(url):
    """Validate URL against security requirements."""
    try:
        parsed = urlparse(url)
        
        # Check protocol (only https allowed)
        if parsed.scheme not in ['https']:
            return False, "Only HTTPS URLs are allowed"
        
        # Get hostname
        hostname = parsed.hostname
        
        # Check if hostname is None or empty
        if not hostname:
            return False, "Invalid URL: no hostname found"
        
        # Check against domain whitelist
        if hostname not in ALLOWED_DOMAINS:
            return False, f"Domain '{hostname}' is not allowed"
        
        # Resolve hostname to IP addresses and check each one
        try:
            ip_addresses = socket.getaddrinfo(hostname, None, socket.AF_INET)
            for addr_info in ip_addresses:
                ip = addr_info[4][0]
                if is_private_ip(ip):
                    return False, f"Access to private/reserved IP address {ip} is blocked"
        except socket.gaierror:
            return False, "Could not resolve hostname"
        
        return True, None
    except Exception as e:
        return False, str(e)

def fetch_url_safe(url, timeout=5):
    """Fetch URL with security checks and timeout."""
    try:
        response = requests.get(url, timeout=timeout)
        return response.text
    except requests.exceptions.Timeout:
        return "Request timed out"
    except requests.exceptions.RequestException as e:
        return f"Request failed: {str(e)}"

@app.route('/fetch')
def fetch():
    url = request.args.get('url', '')
    
    # Validate URL
    is_valid, error_msg = validate_url(url)
    if not is_valid:
        return jsonify({"error": error_msg}), 400
    
    # Fetch the URL with timeout
    result = fetch_url_safe(url, timeout=5)
    
    return jsonify({
        "url": url,
        "content": result[:1000] if len(result) > 1000 else result,  # Limit content size for safety
        "length": min(len(result), 1000)
    })