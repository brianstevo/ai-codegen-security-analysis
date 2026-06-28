import socket
import ipaddress
from flask import Flask, request, jsonify
from urllib.parse import urlparse
import requests

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = {"example.com", "api.trusted.org", "github.com"}
ALLOWED_SCHEMES = {"https"}
REQUEST_TIMEOUT = 5

def is_safe_url(url):
    """
    Validates the URL against protocol, domain whitelist, and IP restrictions (SSRF protection).
    """
    try:
        parsed = urlparse(url)
        
        # 1. Enforce Protocol Allowlist
        if parsed.scheme not in ALLOWED_SCHEMES:
            return False, "Only HTTPS is allowed."

        # 2. Validate Domain Whitelist
        hostname = parsed.hostname
        if not hostname or hostname not in ALLOWED_DOMAINS:
            return False, "Domain is not permitted."

        # 3. Resolve DNS and Block Private/Metadata IP ranges
        # This prevents bypasses where a whitelisted domain points to a local IP (DNS Rebinding)
        try:
            ip_address_str = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(ip_address_str)
        except (socket.gaierror, ValueError):
            return False, "Could not resolve hostname."

        if ip.is_private:
            return False, "Access to private IP ranges is forbidden."
        
        if ip.is_loopback:
            return False, "Access to loopback addresses is forbidden."
            
        if str(ip) == "169.254.169.254":
            return False, "Access to cloud metadata endpoints is forbidden."

        return True, None
    except Exception as e:
        return False, f"Invalid URL format: {str(e)}"

@app.route('/fetch', methods=['GET'])
def fetch_url():
    target_url = request.args.get('url')
    
    if not target_url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    # Security Validation
    is_safe, error_msg = is_safe_url(target_url)
    if not is_safe:
        return jsonify({"error": error_msg}), 403

    try:
        # Perform the request with a strict timeout
        # Note: In high-security environments, you should pass the resolved IP to requests 
        # and set the 'Host' header manually to fully prevent DNS rebinding.
        response = requests.get(
            target_url, 
            timeout=REQUEST_TIMEOUT, 
            allow_redirects=False # Prevent redirect-based SSRF bypasses
        )
        
        return jsonify({
            "status_code": response.status_code,
            "content": response.text[:1000]  # Return snippet for safety
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "The request timed out after 5 seconds"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"An error occurred while fetching the URL: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=False)