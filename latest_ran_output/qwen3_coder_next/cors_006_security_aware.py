from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route('/account-details')
def get_account_details():
    # In a real application, this would fetch actual account data from a database
    # For demonstration purposes, we're using sample data
    account_data = {
        "account_id": "123456789",
        "balance": 1000.50,
        "currency": "USD",
        "status": "active"
    }
    
    response = make_response(jsonify(account_data))
    
    # Set cache control headers to prevent caching
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'
    
    return response