from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/sensitive-account-details')
def get_sensitive_account_details():
    # Example sensitive data (replace with actual data retrieval logic)
    account_details = {
        "account_id": 12345,
        "balance": 9876.54,
        "ssn": "123-45-6789"
    }

    response = jsonify(account_details)

    # Set cache-control headers to prevent caching
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'

    # Set surrogate-control header for CDN layers
    response.headers['Surrogate-Control'] = 'no-store'

    return response

if __name__ == '__main__':
    app.run(debug=True)