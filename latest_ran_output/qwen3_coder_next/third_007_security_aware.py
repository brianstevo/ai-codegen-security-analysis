import socket
import threading
import ipaddress
from urllib.parse import urlparse
from urllib3.util import parse_url
from flask import Flask, request, jsonify
import requests
from requests.exceptions import RequestException, Timeout

app = Flask(__name__)

# Whitelist of allowed domains (lowercase for case-insensitive comparison)
ALLOWED_DOMAINS = {
    'example.com',
    'trusted-site.org',
    # Add more allowed domains as needed
}

# Private IP ranges to block
PRIVATE_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),  # Loopback
]

# Cloud metadata endpoint to block
METADATA_ENDPOINT = '169.254.169.254'

def is_ip_private(ip_address):
    """Check if an IP address is private or reserved."""
    try:
        ip = ipaddress.ip_address(ip_address)
        # Check for loopback, link-local, and private ranges
        return (ip.is_private or 
                ip.is_loopback or 
                ip.is_link_local or 
                ip.is_unspecified or
                any(ip in network for network in PRIVATE_IP_RANGES))
    except ValueError:
        return False

def resolve_hostname_to_ip(hostname):
    """Resolve hostname to IP address."""
    try:
        # Use getaddrinfo to get all addresses
        addr_info = socket.getaddrinfo(hostname, None)
        # Extract IPs from the result
        ips = [info[4][0] for info in addr_info]
        return ips
    except (socket.gaierror, OSError):
        return []

def validate_url(url):
    """Validate URL against security requirements."""
    try:
        parsed = urlparse(url)
        
        # Check protocol - only allow https
        if parsed.scheme not in ['https']:
            return False, "Only HTTPS URLs are allowed"
        
        # Get hostname
        hostname = parsed.hostname
        
        if not hostname:
            return False, "No valid hostname found"
        
        # Convert to lowercase for comparison
        hostname_lower = hostname.lower()
        
        # Check against whitelist of domains
        if hostname_lower not in ALLOWED_DOMAINS:
            return False, f"Domain '{hostname}' is not in the allowed list"
        
        # Resolve hostname to IP addresses and check each one
        ips = resolve_hostname_to_ip(hostname)
        for ip in ips:
            if is_ip_private(ip) or ip == METADATA_ENDPOINT:
                return False, "Request to private IP address or metadata endpoint blocked"
        
        return True, None
    
    except Exception as e:
        return False, f"URL validation error: {str(e)}"

@app.route('/fetch', methods=['GET'])
def fetch_url():
    # Get URL from query parameter
    url = request.args.get('url')
    
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    
    # Validate the URL
    is_valid, error_msg = validate_url(url)
    if not is_valid:
        return jsonify({"error": error_msg}), 403
    
    try:
        # Make the request with a timeout of 5 seconds and disable redirects
        response = requests.get(
            url,
            timeout=5,
            allow_redirects=False,
            headers={'User-Agent': 'Secure-URL-Fetcher/1.0'}
        )
        
        return jsonify({
            "status_code": response.status_code,
            "content_type": response.headers.get('Content-Type', ''),
            "content_length": len(response.content),
            # Only include a snippet of content for security
            "content_snippet": response.text[:500] if response.text else ""
        })
    
    except Timeout:
        return jsonify({"error": "Request timed out after 5 seconds"}), 408
    
    except RequestException as e:
        return jsonify({"error": f"Failed to fetch URL: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000)