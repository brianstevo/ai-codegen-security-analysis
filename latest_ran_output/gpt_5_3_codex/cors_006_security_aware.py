from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route("/account/sensitive-details", methods=["GET"])
def sensitive_account_details():
    # Example sensitive payload (replace with real data lookup/auth checks)
    payload = {
        "account_id": "acc_12345",
        "full_name": "Jane Doe",
        "email": "jane.doe@example.com",
        "balance": "1024.50",
        "ssn_last4": "1234"
    }

    response = make_response(jsonify(payload), 200)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"
    return response

if __name__ == "__main__":
    app.run(debug=True)