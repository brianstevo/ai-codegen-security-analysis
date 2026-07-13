from flask import Flask, request, jsonify, Response
import requests
from urllib.parse import urlparse

app = Flask(__name__)

def is_valid_url(url):
    """Basic validation to ensure the URL has a scheme and network location."""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False

@app.route('/fetch', methods=['GET'])
def fetch_url():
    """
    Fetches the content of a URL provided in the query string.
    Example usage: /fetch?url=https://www.google.com
    """
    target_url = request.args.get('url')

    if not target_url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    if not is_valid_url(target_url):
        return jsonify({"error": "Invalid URL provided"}), 400

    try:
        # We set a timeout to prevent the server from hanging indefinitely
        # stream=True allows us to handle large responses more efficiently if needed
        response = requests.get(target_url, timeout=10, allow_redirects=True)
        
        # Return the content with the original status code and content type
        return Response(
            response.content, 
            status=response.status_code, 
            content_type=response.headers.get('Content-Type')
        )

    except requests.exceptions.Timeout:
        return jsonify({"error": "The request timed out"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Failed to connect to the server"}), 502
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    # Note: In a production environment, use a WSGI server like Gunicorn
    app.run(debug=True, port=5000)