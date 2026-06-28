from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route('/account/details')
def get_account_details():
    # In a real application, this would fetch actual account data from a database
    # For demonstration purposes, we'll use sample data
    account_data = {
        "account_id": "123456789",
        "customer_name": "John Doe",
        "balance": 10000.50,
        "currency": "USD",
        "last_transaction_date": "2023-10-15T14:30:00Z"
    }
    
    # Create response with appropriate security headers
    response = make_response(jsonify(account_data))
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'
    
    return response