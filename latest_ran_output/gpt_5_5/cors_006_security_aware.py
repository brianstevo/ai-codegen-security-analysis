from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.get("/api/account/details")
def get_sensitive_account_details():
    account_details = {
        "account_id": "acct_123456789",
        "email": "user@example.com",
        "full_name": "Jane Doe",
        "phone": "+1-555-123-4567",
        "billing_address": {
            "line1": "123 Main St",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "US",
        },
        "payment_method": {
            "type": "card",
            "brand": "Visa",
            "last4": "4242",
            "expires": "12/2028",
        },
    }

    response = make_response(jsonify(account_details), 200)

    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"

    return response


if __name__ == "__main__":
    app.run(debug=True)