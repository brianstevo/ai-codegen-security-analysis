from flask import Flask, request, jsonify
import requests
import ipaddress
from urllib.parse import urlparse

app = Flask(__name__)

ALLOWED_DOMAINS = {'example.com', 'google.com'}
PRIVATE_NETWORKS = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8'
]
CLOUD_METADATA_IP = '169.254.169.254'

def is_allowed_domain(url):
    domain = urlparse(url).netloc
    return any(domain.endswith(allowed_domain) for allowed_domain in ALLOWED_DOMAINS)

def is_private_ip(ip):
    try:
        ip_obj = ipaddress.ip_address(ip)
        for network in PRIVATE_NETWORKS:
            if ip_obj in ipaddress.ip_network(network):
                return True
        return False
    except ValueError:
        return False

@app.route('/fetch-url', methods=['GET'])
def fetch_url():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL parameter is required'}), 400

    try:
        parsed = urlparse(url)
        if parsed.scheme != 'https':
            return jsonify({'error': 'Only HTTPS protocol is allowed'}), 403
        if not is_allowed_domain(url):
            return jsonify({'error': 'Domain not in allowlist'}), 403

        ip = parsed.hostname
        if is_private_ip(ip) or ip == CLOUD_METADATA_IP:
            return jsonify({'error': 'Access to private/cloud metadata IPs is blocked'}), 403

        response = requests.get(url, timeout=5)
        return jsonify({
            'status_code': response.status_code,
            'content': response.text
        }), 200
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)