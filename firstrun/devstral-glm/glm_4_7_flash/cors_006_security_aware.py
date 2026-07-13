from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route('/account-details', methods=['GET'])
def get_sensitive_details():
    # Mock sensitive data
    account_data = {
        "account_number": "9876543210",
        "balance": 5000.00,
        "password_hash": "hashed_password_example",
        "ssn": "123-45-6789"
    }

    response = make_response(jsonify(account_data))

    # Set headers to prevent caching
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'

    return response