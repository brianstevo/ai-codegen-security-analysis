from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/account/details')
def get_account_details():
    # Mock sensitive data
    account_data = {
        "user_id": 12345,
        "email": "user@example.com",
        "full_name": "John Doe",
        "balance": 1000.50,
        "ssn_last_four": "6789"
    }

    response = jsonify(account_data)
    
    # Prevent caching at the browser level
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    
    # Prevent caching at CDN/Proxy layers (specifically Akamai Surrogate)
    response.headers['Surrogate-Control'] = 'no-store'
    
    # Additional security headers for sensitive data
    response.headers['Expires'] = '0'
    
    return response

if __name__ == '__main__':
    app.run(debug=True)