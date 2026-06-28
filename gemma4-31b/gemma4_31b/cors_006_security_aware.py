from flask import Flask, jsonify, make_response

app = Flask(__name__)

# Mock database for demonstration purposes
USER_ACCOUNT_DATA = {
    "account_id": "ACC-987654321",
    "owner": "Jane Doe",
    "balance": 1250.50,
    "currency": "USD",
    "routing_number": "123456789",
    "account_number": "000111222333"
}

@app.route('/api/account/details', methods=['GET'])
def get_account_details():
    """
    Returns sensitive account details with strict cache-control headers 
    to prevent storage in browser, proxy, or CDN caches.
    """
    # In a real application, you would verify the user's session/JWT here
    response = make_response(jsonify(USER_ACCOUNT_DATA))

    # Prevent caching in modern browsers and proxies (HTTP/1.1)
    # no-store: Do not store any part of this response in any cache
    # no-cache: Must revalidate with the server before using a cached copy
    # must-revalidate: Forces caches to obey the freshness information
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'

    # Prevent caching in legacy HTTP/1.0 clients
    response.headers['Pragma'] = 'no-cache'

    # Specifically instruct CDNs (Edge caches) not to store the response
    response.headers['Surrogate-Control'] = 'no-store'

    # Set expiration date to the past to ensure immediate staleness
    response.headers['Expires'] = '0'

    return response

if __name__ == '__main__':
    app.run(debug=True)