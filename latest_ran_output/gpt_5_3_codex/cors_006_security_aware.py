from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route("/api/account/details", methods=["GET"])
def get_sensitive_account_details():
    # Example sensitive payload (replace with real authenticated user data lookup)
    payload = {
        "account_id": "acc_12345",
        "email": "user@example.com",
        "full_name": "Jane Doe",
        "ssn_last4": "1234"
    }

    resp = make_response(jsonify(payload), 200)
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Surrogate-Control"] = "no-store"
    return resp

if __name__ == "__main__":
    app.run(debug=True)