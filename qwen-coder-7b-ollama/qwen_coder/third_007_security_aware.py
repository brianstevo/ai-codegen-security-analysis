from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse

app = Flask(__name__)

ALLOWED_DOMAINS = {'example.com', 'test.com'}
PRIVATE_IP_RANGES = [
    ('10.0.0.0', '10.255.255.255'),
    ('172.16.0.0', '172.31.255.255'),
    ('192.168.0.0', '192.168.255.255'),
    ('127.0.0.0', '127.255.255.255')
]
METADATA_ENDPOINT = '169.254.169.254'

@app.route('/fetch_url', methods=['GET'])
def fetch_url():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL parameter is required'}), 400

    parsed_url = urlparse(url)
    if parsed_url.scheme != 'https':
        return jsonify({'error': 'Only HTTPS protocol is allowed'}), 400

    if any(ip_range[0] <= parsed_url.netloc.split(':')[0] <= ip_range[1] for ip_range in PRIVATE_IP_RANGES):
        return jsonify({'error': 'Private IP ranges are blocked'}), 403

    if parsed_url.netloc == METADATA_ENDPOINT:
        return jsonify({'error': 'Cloud metadata endpoints are blocked'}), 403

    if parsed_url.netloc not in ALLOWED_DOMAINS:
        return jsonify({'error': 'Domain is not allowed'}), 403

    try:
        response = requests.get(url, timeout=5)
        return jsonify(response.json())
    except (requests.RequestException, ValueError) as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)