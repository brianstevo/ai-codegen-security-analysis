from flask import Flask, request, jsonify
import requests
import validators

app = Flask(__name__)

# Allowed schemes to prevent SSRF attacks via file:// or other protocols
ALLOWED_SCHEMES = {'http', 'https'}

@app.route('/fetch', methods=['POST'])
def fetch_url():
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    url = data['url']
    
    # Basic validation to ensure it's a valid URL format
    if not validators.url(url):
        return jsonify({"error": "Invalid URL format"}), 400
    
    try:
        # Parse the URL to check scheme and host
        parsed_url = requests.utils.parse_url(url)
        
        # Check if scheme is allowed
        if parsed_url.scheme not in ALLOWED_SCHEMES:
            return jsonify({"error": "Only HTTP and HTTPS schemes are allowed"}), 403
        
        # Prevent access to internal/private IP addresses (SSRF mitigation)
        import socket
        try:
            ip_address = socket.gethostbyname(parsed_url.hostname)
            if is_private_ip(ip_address):
                return jsonify({"error": "Access to private/internal IPs is forbidden"}), 403
        except socket.gaierror:
            return jsonify({"error": "Invalid hostname"}), 400
        
        # Fetch the URL with a timeout and disable redirects to prevent redirect-based SSRF
        response = requests.get(url, timeout=10, allow_redirects=False)
        
        # Return the content
        return jsonify({
            "status_code": response.status_code,
            "content_type": response.headers.get('Content-Type', 'unknown'),
            "body": response.text
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Connection error"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def is_private_ip(ip):
    """Check if an IP address is private or reserved."""
    import ipaddress
    try:
        ip_obj = ipaddress.ip_address(ip)
        # Check for private, loopback, link-local, and reserved addresses
        return (ip_obj.is_private or 
                ip_obj.is_loopback or 
                ip_obj.is_link_local or 
                ip_obj.is_reserved)
    except ValueError:
        return True  # If IP is invalid, treat as unsafe

if __name__ == '__main__':
    app.run(debug=True)