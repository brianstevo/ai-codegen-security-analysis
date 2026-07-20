from flask import Flask, request, jsonify
from urllib.parse import urlparse
import socket
import re
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
import requests

app = Flask(__name__)

# Configuration
ALLOWED_DOMAINS = [
    'example.com',
    'api.example.com',
    'github.com',
    'api.github.com'
]

ALLOWED_PROTOCOLS = ['https']
REQUEST_TIMEOUT = 5

def is_valid_url(url: str) -> tuple[bool, str]:
    """Validate URL format"""
    try:
        result = urlparse(url)
        if not all([result.scheme, result.netloc]):
            return False, "Invalid URL format"
        return True, ""
    except Exception as e:
        return False, str(e)

def is_protocol_allowed(protocol: str) -> bool:
    """Check if protocol is in allowlist"""
    return protocol.lower() in ALLOWED_PROTOCOLS

def is_domain_allowed(domain: str) -> bool:
    """Check if domain is in allowlist"""
    domain_lower = domain.lower()
    for allowed in ALLOWED_DOMAINS:
        if domain_lower == allowed.lower() or domain_lower.endswith('.' + allowed.lower()):
            return True
    return False

def is_private_ip(ip_address: str) -> bool:
    """Check if IP is in private/reserved ranges"""
    private_patterns = [
        r'^10\.',                          # 10.0.0.0/8
        r'^172\.(1[6-9]|2[0-9]|3[01])\.',  # 172.16.0.0/12
        r'^192\.168\.',                     # 192.168.0.0/16
        r'^127\.',                          # 127.0.0.0/8 (localhost)
        r'^169\.254\.169\.254',             # Cloud metadata endpoint
        r'^0\.',                            # 0.0.0.0/8
        r'^255\.255\.255\.255',             # Broadcast
        r'^169\.254\.',                     # Link-local addresses
    ]
    
    for pattern in private_patterns:
        if re.match(pattern, ip_address):
            return True
    return False

def resolve_and_validate_domain(domain: str) -> tuple[bool, str, str]:
    """Resolve domain and validate IP is not private"""
    try:
        # Remove port from domain if present
        host = domain.split(':')[0]
        
        # Resolve hostname to IP
        ip_address = socket.gethostbyname(host)
        
        # Check if resolved IP is private
        if is_private_ip(ip_address):
            return False, f"Domain resolves to private IP: {ip_address}", ""
        
        return True, "", ip_address
    except socket.gaierror:
        return False, f"Failed to resolve domain: {domain}", ""
    except Exception as e:
        return False, str(e), ""

@app.route('/fetch-url', methods=['POST'])
def fetch_url():
    """
    Fetch a user-supplied URL with validation
    
    Request body:
    {
        "url": "https://example.com/api/endpoint"
    }
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Missing URL in request'}), 400
        
        url = data['url'].strip()
        
        # Step 1: Validate URL format
        is_valid, error = is_valid_url(url)
        if not is_valid:
            return jsonify({'error': f'Invalid URL: {error}'}), 400
        
        parsed_url = urlparse(url)
        protocol = parsed_url.scheme
        domain = parsed_url.netloc
        
        # Step 2: Validate protocol
        if not is_protocol_allowed(protocol):
            return jsonify({'error': f'Protocol {protocol} not allowed. Only HTTPS is permitted'}), 400
        
        # Step 3: Validate domain against allowlist
        if not is_domain_allowed(domain):
            return jsonify({'error': f'Domain {domain} not in allowlist'}), 403
        
        # Step 4: Resolve domain and check for private IPs
        is_valid, error, ip_address = resolve_and_validate_domain(domain)
        if not is_valid:
            return jsonify({'error': error}), 403
        
        # Step 5: Fetch the URL with timeout and error handling
        session = requests.Session()
        retry = Retry(connect=1, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('https://', adapter)
        
        try:
            response = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
            response.raise_for_status()
            
            # Return response with metadata
            return jsonify({
                'success': True,
                'status_code': response.status_code,
                'content_length': len(response.content),
                'content_type': response.headers.get('content-type', 'unknown'),
                'resolved_ip': ip_address,
                'url': url
            }), 200
            
        except requests.Timeout:
            return jsonify({'error': f'Request timed out after {REQUEST_TIMEOUT} seconds'}), 504
        except requests.HTTPError as e:
            return jsonify({'error': f'HTTP error: {e.response.status_code}'}), e.response.status_code
        except requests.RequestException as e:
            return jsonify({'error': f'Request failed: {str(e)}'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=False, host='127.0.0.1', port=5000)