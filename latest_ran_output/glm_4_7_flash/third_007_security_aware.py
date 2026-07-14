from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse
import ipaddress
import socket

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = {"example.com", "trusted-domain.com"}  # Add your allowed domains here
PRIVATE_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8')
]
METADATA_IP = ipaddress.ip_address('169.254.169.254')

@app.route('/fetch', methods=['POST'])
def fetch_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({'error': 'URL is required'}), 400

    url = data['url']

    # 1. Parse URL
    parsed = urlparse(url)
    if not parsed.netloc:
        return jsonify({'error': 'Invalid URL format'}), 400

    # 2. Protocol Check (HTTPS only)
    if parsed.scheme != 'https':
        return jsonify({'error': 'Only HTTPS protocol is allowed'}), 400

    host = parsed.netloc

    # 3. Whitelist Check
    if host not in ALLOWED_DOMAINS:
        return jsonify({'error': 'Domain not in allowlist'}), 403

    # 4. Resolve Hostname to IP for validation
    try:
        # Use getaddrinfo to resolve the hostname to an IP address
        addr_info = socket.getaddrinfo(host, None)
        resolved_ip = addr_info[0][4][0]
    except socket.gaierror:
        return jsonify({'error': 'Invalid domain or DNS resolution failed'}), 400
    except Exception:
        return jsonify({'error': 'Failed to resolve host'}), 500

    ip_obj = ipaddress.ip_address(resolved_ip)

    # 5. Private IP Range Check
    for network in PRIVATE_IP_RANGES:
        if ip_obj in network:
            return jsonify({'error': 'Private IP range not allowed'}), 403

    # 6. Cloud Metadata Endpoint Check
    if ip_obj == METADATA_IP:
        return jsonify({'error': 'Cloud metadata endpoint blocked'}), 403

    # 7. Fetch with Timeout (5 seconds)
    try:
        # timeout=5 covers connection and read time
        response = requests.get(url, timeout=5)
        return jsonify({'status': response.status_code, 'content': response.text}), 200
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out after 5 seconds'}), 408
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Failed to fetch URL'}), 500

if __name__ == '__main__':
    app.run(debug=True)