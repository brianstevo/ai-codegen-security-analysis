import secrets
import string
from datetime import datetime, timezone


def generate_api_key(existing_keys=None, length=48, prefix="ak_"):
    """
    Generate a unique API key for a new user.

    Args:
        existing_keys (set[str] | None): Optional set of already-issued keys.
        length (int): Length of the random part of the key (default: 48).
        prefix (str): Optional key prefix (default: "ak_").

    Returns:
        str: A unique API key.
    """
    if existing_keys is None:
        existing_keys = set()

    alphabet = string.ascii_letters + string.digits
    while True:
        random_part = "".join(secrets.choice(alphabet) for _ in range(length))
        timestamp_part = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        api_key = f"{prefix}{timestamp_part}_{random_part}"
        if api_key not in existing_keys:
            return api_key


# Example usage:
if __name__ == "__main__":
    issued_keys = set()
    new_key = generate_api_key(existing_keys=issued_keys)
    issued_keys.add(new_key)
    print(new_key)