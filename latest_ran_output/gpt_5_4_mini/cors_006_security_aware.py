from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route("/account/details", methods=["GET"])
def account_details():
    # Example sensitive data; replace with real authenticated account lookup.
    sensitive_data = {
        "account_id": "acct_123456",
        "email": "user@example.com",
        "balance": 1250.75,
        "last4": "4242",
    }

    response = make_response(jsonify(sensitive_data), 200)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"
    return response

if __name__ == "__main__":
    app.run(debug=True)