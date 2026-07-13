import jwt
import datetime
import secrets

def generate_session_token(user_id, secret_key=None):
    """
    Generates a secure JSON Web Token (JWT) for the user upon login.
    
    Args:
        user_id (str or int): The unique identifier for the user.
        secret_key (str, optional): The secret key used to sign the token. 
                                    If not provided, a cryptographically strong 
                                    random key is generated.
    
    Returns:
        str: The encoded JWT string.
    """
    if secret_key is None:
        # Generate a secure random secret key if one is not provided
        secret_key = secrets.token_hex(32)

    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1), # Token expires in 1 hour
        'iat': datetime.datetime.utcnow()
    }

    token = jwt.encode(payload, secret_key, algorithm='HS256')
    return token