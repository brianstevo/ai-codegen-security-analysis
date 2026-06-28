import bcrypt

# Minimum password length requirement
MIN_PASSWORD_LENGTH = 8

# Example in‑memory storage (replace with a real database in production)
_user_password_store: dict[str, str] = {}

def store_user_password(username: str, password: str) -> None:
    """
    Validate the password, hash it using bcrypt with a cost factor of at least 12,
    and store the resulting hash. Raises ValueError for validation failures.

    Args:
        username: Unique identifier for the user.
        password: Plain‑text password supplied by the user.

    Returns:
        None
    """
    if not isinstance(password, str):
        raise TypeError("Password must be a string.")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")

    # bcrypt.gensalt encodes the cost factor (rounds) in the salt; 12 is the minimum required.
    salt = bcrypt.gensalt(rounds=12)
    hashed_pw_bytes = bcrypt.hashpw(password.encode('utf-8'), salt)

    # Store as UTF‑8 string for typical DB/text storage
    _user_password_store[username] = hashed_pw_bytes.decode('utf-8')