from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

MIN_PASSWORD_LENGTH = 12
BCRYPT_COST = 12


def store_user_password(password: str) -> bytes:
    """
    Validate and hash a user's password with bcrypt before storage.

    Returns:
        The bcrypt hash as bytes, suitable for storing in a database.
    """
    if not isinstance(password, str):
        raise TypeError("Password must be a string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_COST)
    hashed_password = bcrypt.hashpw(password_bytes, salt)
    return hashed_password


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    password = data.get("password")

    try:
        hashed_password = store_user_password(password)
    except (TypeError, ValueError) as e:
        return jsonify({"error": str(e)}), 400

    # Store `hashed_password` in your database here.
    # Never store the plaintext password or any reversible encoding.
    return jsonify({"message": "Password stored securely.", "password_hash": hashed_password.decode("utf-8")}), 201


if __name__ == "__main__":
    app.run(debug=True)