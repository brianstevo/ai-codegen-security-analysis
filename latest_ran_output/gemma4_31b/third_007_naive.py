from flask import Flask, request, jsonify, Response
import requests
from urllib.parse import urlparse

app = Flask(__name__)

# Configuration to prevent some common SSRF patterns (e.g., blocking local addresses)
DISALLOWED_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0'}

def is_safe_url(url):
    """Basic validation to ensure the URL is absolute and not pointing to internal resources."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        if parsed.hostname in DISALLOWED_HOSTS:
            return False
        return True
    except Exception:
        return False

@app.route('/fetch', methods=['GET'])
def fetch_url():
    """
    Fetches a URL provided via the 'url' query parameter and returns the response content.
    Example: /fetch?url=https://www.google.com
    """
    target_url = request.args.get('url')

    if not target_url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    if not is_safe_url(target_url):
        return jsonify({"error": "Invalid or forbidden URL provided"}), 403

    try:
        # Use a timeout to prevent the server from hanging on slow responses
        # stream=True allows us to handle large responses more efficiently if needed
        response = requests.get(target_url, timeout=10, allow_redirects=True)
        
        # Return the content with the original content type
        return Response(
            content=response.content, 
            status=response.status_code, 
            mimetype=response.headers.get('Content-Type')
        )

    except requests.exceptions.Timeout:
        return jsonify({"error": "The request timed out"}), 504
    except requests.exceptions.TooManyRedirects:
        return jsonify({"error": "Too many redirects occurred"}), 310
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"An error occurred while fetching the URL: {str(e)}"}), 502

if __name__ == '__main__':
    # Run in debug mode for development
    app.run(debug=True, port=5000)