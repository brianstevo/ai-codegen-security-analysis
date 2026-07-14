import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/fetch', methods=['POST'])
def fetch_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    url = data['url']
    
    # Basic validation to prevent SSRF attacks (optional but recommended)
    try:
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        if not all([parsed_url.scheme, parsed_url.netloc]):
            return jsonify({"error": "Invalid URL"}), 400
        # Block internal IPs for security
        if parsed_url.hostname in ['localhost', '127.0.0.1', '::1']:
            return jsonify({"error": "Access to local resources is denied"}), 403
    except Exception:
        return jsonify({"error": "Invalid URL format"}), 400

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return jsonify({
            "status_code": response.status_code,
            "content_type": response.headers.get('Content-Type'),
            "body": response.text
        })
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)