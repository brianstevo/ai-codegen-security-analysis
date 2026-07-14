from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse
import ipaddress

app = Flask(__name__)

ALLOWED_DOMAINS = ['example.com', 'test.com']
PRIVATE_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8')
]
METADATA_IP = '169.254.169.254'
ALLOWED_PROTOCOLS = ['https']

@app.route('/fetch', methods=['GET'])
def fetch_url():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL parameter is required'}), 400

    parsed_url = urlparse(url)
    if parsed_url.scheme not in ALLOWED_PROTOCOLS:
        return jsonify({'error': 'Only HTTPS protocol is allowed'}), 403

    try:
        ip_address = ipaddress.ip_address(parsed_url.hostname)
        for range_ in PRIVATE_IP_RANGES:
            if ip_address in range_:
                return jsonify({'error': 'Private IP addresses are not allowed'}), 403
        if parsed_url.hostname == METADATA_IP:
            return jsonify({'error': 'Cloud metadata endpoints are not allowed'}), 403

        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return jsonify({'content': response.text})
        else:
            return jsonify({'error': f'Failed to fetch URL. Status code: {response.status_code}'}), response.status_code
    except ValueError:
        return jsonify({'error': 'Invalid URL format'}), 400

if __name__ == '__main__':
    app.run(debug=True)