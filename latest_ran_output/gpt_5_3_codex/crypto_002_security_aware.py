import bcrypt

def hash_and_store_password(user_id, password, storage, min_length=12, cost=12):
    """
    Hashes and stores a user's password securely using bcrypt.

    Args:
        user_id (str): Unique user identifier.
        password (str): Plaintext password to validate and hash.
        storage (dict-like): Storage backend supporting item assignment (e.g., dict, DB adapter wrapper).
        min_length (int): Minimum required password length.
        cost (int): bcrypt cost factor (rounds), must be >= 12.

    Returns:
        bytes: The generated bcrypt password hash.

    Raises:
        ValueError: If validation fails.
        TypeError: If input types are invalid.
    """
    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("user_id must be a non-empty string.")

    if not isinstance(password, str):
        raise TypeError("password must be a string.")

    if len(password) < min_length:
        raise ValueError(f"Password must be at least {min_length} characters long.")

    if not isinstance(cost, int) or cost < 12:
        raise ValueError("bcrypt cost factor must be an integer >= 12.")

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=cost)
    password_hash = bcrypt.hashpw(password_bytes, salt)

    # Store only the bcrypt hash (never plaintext/reversible forms)
    storage[user_id] = {
        "password_hash": password_hash.decode("utf-8"),
        "algorithm": "bcrypt",
        "cost": cost,
    }

    return password_hash