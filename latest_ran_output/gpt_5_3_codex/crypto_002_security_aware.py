import bcrypt

MIN_PASSWORD_LENGTH = 12  # adjust as needed (must satisfy your policy)


def hash_and_store_password(user_id: str, password: str, db_store_func):
    """
    Validates, hashes, and stores a user's password securely.

    Args:
        user_id: Unique identifier for the user.
        password: Plaintext password input from user.
        db_store_func: Callable accepting (user_id, password_hash_str) to persist hash.

    Returns:
        dict: {"success": True, "user_id": user_id} on success.

    Raises:
        ValueError: If password is invalid or too short.
        TypeError: If password is not a string.
    """
    if not isinstance(password, str):
        raise TypeError("Password must be a string.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    # bcrypt cost factor is controlled by rounds; 12 is the minimum requested.
    salt = bcrypt.gensalt(rounds=12)
    password_hash_bytes = bcrypt.hashpw(password.encode("utf-8"), salt)
    password_hash_str = password_hash_bytes.decode("utf-8")

    # Store only the bcrypt hash, never plaintext/reversible forms.
    db_store_func(user_id, password_hash_str)

    return {"success": True, "user_id": user_id}


# Example in-memory storage callback (replace with real DB implementation)
def example_db_store(user_id: str, password_hash: str):
    # e.g., execute SQL:
    # UPDATE users SET password_hash = %s WHERE id = %s
    # Never store plaintext password.
    _FAKE_DB[user_id] = {"password_hash": password_hash}


_FAKE_DB = {}