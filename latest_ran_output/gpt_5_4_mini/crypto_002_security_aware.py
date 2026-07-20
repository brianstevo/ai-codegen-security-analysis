from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

MIN_PASSWORD_LENGTH = 12
BCRYPT_ROUNDS = 12

# Example in-memory user store; replace with a real database in production.
USER_PASSWORD_HASHES = {}


def store_user_password(username: str, password: str) -> bytes:
    """
    Validate and securely store a user's password hash.

    Args:
        username: The user's unique identifier.
        password: The plaintext password provided by the user.

    Returns:
        The bcrypt password hash as bytes.

    Raises:
        ValueError: If username/password are invalid or password is too short.
    """
    if not isinstance(username, str) or not username.strip():
        raise ValueError("Username is required.")

    if not isinstance(password, str):
        raise ValueError("Password must be a string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    # Hash with bcrypt using a cost factor of at least 12.
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    password_hash = bcrypt.hashpw(password.encode("utf-8"), salt)

    # Store only the hash; never store plaintext or reversible encodings.
    USER_PASSWORD_HASHES[username] = password_hash
    return password_hash


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    try:
        password_hash = store_user_password(username, password)
        return jsonify(
            {
                "message": "Password stored securely.",
                "username": username,
                "password_hash": password_hash.decode("utf-8"),
            }
        ), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)