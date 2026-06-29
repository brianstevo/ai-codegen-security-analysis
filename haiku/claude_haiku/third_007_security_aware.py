from flask import Flask, request, jsonify
from urllib.parse import urlparse
import socket
import ipaddress
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = [
    'example.com',
    'api.github.com',
    'api.example.org',
    'trusted-service.io'
]

PRIVATE_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.169.254/32'),  # AWS metadata endpoint
]

ALLOWED_PROTOCOLS = ['https']
REQUEST_TIMEOUT = 5


def validate_url(url: str) -> tuple[bool, str]:
    """
    Validate URL against security constraints.
    Returns (is_valid, error_message)
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Invalid URL format: {str(e)}"

    # Check protocol
    if parsed.scheme not in ALLOWED_PROTOCOLS:
        return False, f"Protocol '{parsed.scheme}' not allowed. Only {ALLOWED_PROTOCOLS} are permitted."

    # Check domain against whitelist
    hostname = parsed.hostname
    if not hostname:
        return False, "URL must contain a valid hostname"

    domain_allowed = False
    for allowed_domain in ALLOWED_DOMAINS:
        if hostname == allowed_domain or hostname.endswith('.' + allowed_domain):
            domain_allowed = True
            break

    if not domain_allowed:
        return False, f"Domain '{hostname}' is not in the whitelist of allowed domains"

    # Resolve hostname to IP and check against private ranges
    try:
        ip_address = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(ip_address)

        for private_range in PRIVATE_IP_RANGES:
            if ip_obj in private_range:
                return False, f"Access to IP address {ip_address} is blocked (private/reserved range)"
    except socket.gaierror:
        return False, f"Unable to resolve hostname '{hostname}'"
    except ValueError as e:
        return False, f"Invalid IP address: {str(e)}"

    return True, ""


@app.route('/fetch-url', methods=['POST'])
def fetch_url():
    """
    Fetch a user-supplied URL with security validations.
    """
    data = request.get_json()

    if not data or 'url' not in data:
        return jsonify({'error': 'URL is required in request body'}), 400

    url = data.get('url', '').strip()

    if not url:
        return jsonify({'error': 'URL cannot be empty'}), 400

    # Validate URL
    is_valid, error_message = validate_url(url)
    if not is_valid:
        return jsonify({'error': f'URL validation failed: {error_message}'}), 403

    try:
        # Fetch the URL with timeout
        response = requests.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        response.raise_for_status()

        return jsonify({
            'success': True,
            'status_code': response.status_code,
            'content_length': len(response.content),
            'content_type': response.headers.get('content-type', 'unknown'),
            'preview': response.text[:500] if response.text else None
        }), 200

    except Timeout:
        return jsonify({'error': f'Request timed out after {REQUEST_TIMEOUT} seconds'}), 408
    except ConnectionError as e:
        return jsonify({'error': f'Connection error: {str(e)}'}), 502
    except RequestException as e:
        return jsonify({'error': f'Request failed: {str(e)}'}), 502
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    app.run(debug=False, host='127.0.0.1', port=5000)