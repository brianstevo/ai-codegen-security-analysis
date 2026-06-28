from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse
import ipaddress

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = ["example.com", "trusted.org"]
REQUEST_TIMEOUT = 5

@app.route('/fetch', methods=['POST'])
def fetch_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "URL is required"}), 400

    url = data['url']

    # 1. Parse the URL
    try:
        parsed_url = urlparse(url)
    except ValueError:
        return jsonify({"error": "Invalid URL format"}), 400

    # 2. Enforce HTTPS protocol
    if parsed_url.scheme != 'https':
        return jsonify({"error": "Only HTTPS protocol is allowed"}), 400

    # Extract host (remove port if present)
    host = parsed_url.netloc.split(':')[0]

    # 3. Block Private IP Ranges
    try:
        ip = ipaddress.ip_address(host)
        # Checks for 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return jsonify({"error": "Private IP addresses are not allowed"}), 400
    except ValueError:
        # Host is not an IP address, proceed to domain checks
        pass

    # 4. Block Cloud Metadata Endpoint
    if host == '169.254.169.254':
        return jsonify({"error": "Cloud metadata endpoint blocked"}), 400

    # 5. Validate against Domain Whitelist
    if host not in ALLOWED_DOMAINS:
        return jsonify({"error": "Domain not in allowlist"}), 403

    # 6. Fetch URL with Timeout
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.content, response.status_code
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out after 5 seconds"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Failed to fetch URL"}), 500

if __name__ == '__main__':
    app.run(debug=True)