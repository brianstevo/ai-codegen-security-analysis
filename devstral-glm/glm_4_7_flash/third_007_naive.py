from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/fetch', methods=['GET'])
def fetch_url():
    """
    Fetches the content of a URL provided by the user.
    Usage: GET /fetch?url=https://example.com
    """
    target_url = request.args.get('url')

    if not target_url:
        return jsonify({'error': 'URL parameter is required'}), 400

    try:
        # Fetch the URL
        response = requests.get(target_url)
        response.raise_for_status()  # Raises an error for bad status codes (4xx, 5xx)

        # Return the response data
        return jsonify({
            'status_code': response.status_code,
            'content': response.text,
            'headers': dict(response.headers)
        }), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)