from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse

app = Flask(__name__)

@app.route('/fetch', methods=['POST'])
def fetch_url():
    """
    Fetches a URL provided by the user and returns the response.
    
    Expected JSON payload:
    {
        "url": "https://example.com"
    }
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data or 'url' not in data:
            return jsonify({
                'error': 'Missing required field: url'
            }), 400
        
        url = data['url']
        
        # Validate URL format
        try:
            result = urlparse(url)
            if not all([result.scheme, result.netloc]):
                return jsonify({
                    'error': 'Invalid URL format'
                }), 400
        except Exception:
            return jsonify({
                'error': 'Invalid URL format'
            }), 400
        
        # Fetch the URL with timeout
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        return jsonify({
            'status_code': response.status_code,
            'content_type': response.headers.get('content-type'),
            'content_length': len(response.content),
            'content': response.text[:5000],  # Limit response size
            'headers': dict(response.headers)
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({
            'error': 'Request timeout'
        }), 504
    except requests.exceptions.ConnectionError:
        return jsonify({
            'error': 'Connection error'
        }), 503
    except requests.exceptions.HTTPError as e:
        return jsonify({
            'error': f'HTTP error: {e.response.status_code}'
        }), e.response.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': f'Request failed: {str(e)}'
        }), 400
    except Exception as e:
        return jsonify({
            'error': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/fetch-with-headers', methods=['POST'])
def fetch_url_with_headers():
    """
    Fetches a URL with optional custom headers.
    
    Expected JSON payload:
    {
        "url": "https://example.com",
        "headers": {"Authorization": "Bearer token", ...}
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'url' not in data:
            return jsonify({
                'error': 'Missing required field: url'
            }), 400
        
        url = data['url']
        headers = data.get('headers', {})
        
        # Validate URL format
        try:
            result = urlparse(url)
            if not all([result.scheme, result.netloc]):
                return jsonify({
                    'error': 'Invalid URL format'
                }), 400
        except Exception:
            return jsonify({
                'error': 'Invalid URL format'
            }), 400
        
        # Ensure headers is a dictionary
        if not isinstance(headers, dict):
            return jsonify({
                'error': 'Headers must be a dictionary'
            }), 400
        
        # Fetch the URL with custom headers
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        return jsonify({
            'status_code': response.status_code,
            'content_type': response.headers.get('content-type'),
            'content_length': len(response.content),
            'content': response.text[:5000],
            'headers': dict(response.headers)
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({
            'error': 'Request timeout'
        }), 504
    except requests.exceptions.ConnectionError:
        return jsonify({
            'error': 'Connection error'
        }), 503
    except requests.exceptions.HTTPError as e:
        return jsonify({
            'error': f'HTTP error: {e.response.status_code}'
        }), e.response.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': f'Request failed: {str(e)}'
        }), 400
    except Exception as e:
        return jsonify({
            'error': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy'
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)