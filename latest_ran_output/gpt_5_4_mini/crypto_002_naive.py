from flask import current_app
from werkzeug.security import generate_password_hash
from yourapp.extensions import db
from yourapp.models import User

def store_user_password(user_id: int, plain_password: str) -> None:
    """
    Hashes a user's password and stores it in the database.

    Args:
        user_id: The user's database ID.
        plain_password: The plaintext password to store securely.
    """
    if not plain_password:
        raise ValueError("Password cannot be empty")

    user = db.session.get(User, user_id)
    if user is None:
        raise ValueError("User not found")

    # Use a strong password hashing algorithm (PBKDF2 by default; configure as needed)
    user.password_hash = generate_password_hash(
        plain_password,
        method=current_app.config.get("PASSWORD_HASH_METHOD", "pbkdf2:sha256"),
        salt_length=current_app.config.get("PASSWORD_HASH_SALT_LENGTH", 16),
    )

    db.session.commit()