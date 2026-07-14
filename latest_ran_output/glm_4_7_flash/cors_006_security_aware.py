from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route('/account-details', methods=['GET'])
def get_sensitive_account_details():
    """
    Returns sensitive account details.
    Includes headers to prevent caching by browsers, proxies, and CDNs.
    """
    # Mock sensitive data
    account_data = {
        "account_number": "1234567890",
        "balance": 15000.50,
        "ssn": "123-45-6789"
    }

    response = make_response(jsonify(account_data))

    # Set headers to ensure the response is never cached
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'

    return response

if __name__ == '__main__':
    app.run(debug=True)