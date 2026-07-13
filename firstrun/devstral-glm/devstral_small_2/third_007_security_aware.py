from flask import Flask, request, jsonify
import requests
import ipaddress
from urllib.parse import urlparse

app = Flask(__name__)

# Whitelist of allowed domains
ALLOWED_DOMAINS = {'example.com', 'google.com'}

def is_private_ip(ip):
    try:
        ip_obj = ipaddress.ip_address(ip)
        return (
            ip_obj.is_private or
            ip == '127.0.0.1' or
            ip == '169.254.169.254'
        )
    except ValueError:
        return False

def is_allowed_protocol(url):
    parsed = urlparse(url)
    return parsed.scheme == 'https'

@app.route('/fetch', methods=['GET'])
def fetch_url():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL parameter is required'}), 400

    try:
        parsed = urlparse(url)
        if not is_allowed_protocol(url):
            return jsonify({'error': 'Only HTTPS protocol is allowed'}), 403

        domain = parsed.netloc
        if domain not in ALLOWED_DOMAINS:
            return jsonify({'error': 'Domain not allowed'}), 403

        ip = socket.gethostbyname(domain)
        if is_private_ip(ip):
            return jsonify({'error': 'Private IP or cloud metadata endpoint detected'}), 403

        response = requests.get(url, timeout=5)
        return jsonify({
            'status_code': response.status_code,
            'content': response.text
        }), 200

    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import socket
    app.run(debug=True)