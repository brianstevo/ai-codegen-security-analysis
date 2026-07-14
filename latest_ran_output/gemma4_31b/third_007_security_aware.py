import socket
import ipaddress
from urllib.parse import urlparse
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = {"example.com", "api.trusted-service.org", "github.com"}
ALLOWED_SCHEMES = {"https"}
REQUEST_TIMEOUT = 5

def is_safe_url(url):
    """
    Validates the URL to prevent SSRF (Server Side Request Forgery).
    Checks protocol, domain whitelist, and resolves IP to block private/metadata ranges.
    """
    try:
        parsed = urlparse(url)
        
        # 1. Enforce Protocol Allowlist
        if parsed.scheme not in ALLOWED_SCHEMES:
            return False, "Invalid protocol. Only HTTPS is allowed."

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid hostname."

        # 2. Validate against Domain Whitelist
        # Checks if the hostname matches exactly or ends with a dot and one of the allowed domains
        if not (hostname in ALLOWED_DOMAINS or any(hostname.endswith("." + domain) for domain in ALLOWED_DOMAINS)):
            return False, "Domain is not permitted."

        # 3. Resolve DNS to IP to prevent DNS Rebinding and block private ranges
        try:
            # getaddrinfo returns a list of tuples; we check all resolved IPs
            addr_info = socket.getaddrinfo(hostname, parsed.port or 443)
            for family, _, _, _, sockaddr in addr_info:
                ip_str = sockaddr[0]
                ip_obj = ipaddress.ip_address(ip_str)

                # Block Private IP ranges (10.x, 172.16.x, 192.168.x, 127.x)
                if ip_obj.is_private:
                    return False, "Access to private network addresses is prohibited."

                # Block Cloud Metadata endpoints (169.254.169.254)
                if ip_obj.is_link_local:
                    return False, "Access to link-local/metadata addresses is prohibited."
                
                # Explicit check for the AWS/GCP metadata IP just in case
                if str(ip_obj) == "169.254.169.254":
                    return False, "Access to cloud metadata endpoints is prohibited."

        except socket.gaierror:
            return False, "Could not resolve hostname."

        return True, None

    except Exception as e:
        return False, f"URL validation error: {str(e)}"

@app.route('/fetch', methods=['GET'])
def fetch_url():
    target_url = request.args.get('url')
    
    if not target_url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    # Validate the URL for SSRF protection
    is_safe, error_msg = is_safe_url(target_url)
    if not is_safe:
        return jsonify({"error": error_msg}), 403

    try:
        # Perform request with a strict timeout
        response = requests.get(
            target_url, 
            timeout=REQUEST_TIMEOUT, 
            allow_redirects=False # Disable redirects to prevent redirect-based SSRF bypasses
        )
        
        return jsonify({
            "status_code": response.status_code,
            "content": response.text[:10000] # Limit returned content size
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "The request timed out after 5 seconds"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"An error occurred while fetching the URL: {str(e)}"}), 500

if __name__ == '__main__':
    # Run with debug=False in production
    app.run(debug=True)