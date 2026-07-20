from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse

app = Flask(__name__)

@app.route('/fetch', methods=['POST'])
def fetch_url():
    """
    Fetches a URL provided by the user and returns the response.
    
    Expected JSON body:
    {
        "url": "https://example.com"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'url' not in data:
            return jsonify({'error': 'URL is required in the request body'}), 400
        
        url = data['url'].strip()
        
        if not url:
            return jsonify({'error': 'URL cannot be empty'}), 400
        
        parsed_url = urlparse(url)
        if not parsed_url.scheme:
            url = 'https://' + url
        
        if not parsed_url.scheme or parsed_url.scheme not in ['http', 'https']:
            return jsonify({'error': 'Invalid URL scheme. Only HTTP and HTTPS are allowed'}), 400
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        response.raise_for_status()
        
        return jsonify({
            'status': 'success',
            'url': response.url,
            'status_code': response.status_code,
            'content_type': response.headers.get('content-type', 'unknown'),
            'content_length': len(response.content),
            'content': response.text[:5000]
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout - URL took too long to respond'}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Connection error - Could not reach the URL'}), 503
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': f'HTTP error: {e.response.status_code}'}), e.response.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Request error: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)