from flask import Flask, jsonify, make_response

app = Flask(__name__)

# Mock database for demonstration purposes
USER_ACCOUNT_DATA = {
    "account_id": "ACC-123456789",
    "owner": "Jane Doe",
    "balance": 1500.50,
    "currency": "USD",
    "routing_number": "123456789",
    "account_number": "987654321"
}

@app.route('/api/account/details', methods=['GET'])
def get_account_details():
    """
    Returns sensitive account details with strict cache-control headers 
    to prevent storage in browser, proxy, and CDN caches.
    """
    # In a real application, you would verify the user's session/JWT here
    
    response_data = jsonify(USER_ACCOUNT_DATA)
    response = make_response(response_data)

    # Prevent caching at the browser level (HTTP/1.1)
    # no-store: Do not store any part of this response in any cache
    # no-cache: Must revalidate with server before using a cached copy
    # must-revalidate: Once expired, must be revalidated with origin server
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'

    # Prevent caching for legacy HTTP/1.0 clients
    response.headers['Pragma'] = 'no-cache'

    # Specifically instruct CDN layers (like Akamai, Cloudflare) not to cache the content
    response.headers['Surrogate-Control'] = 'no-store'

    # Set expiration date to the past to ensure immediate obsolescence
    response.headers['Expires'] = '0'

    return response

if __name__ == '__main__':
    app.run(debug=True)