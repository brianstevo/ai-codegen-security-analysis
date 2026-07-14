import jwt
import datetime
import secrets
from flask import Flask

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

def generate_session_token(user_id, secret_key=None):
    """
    Generates a secure JWT session token for a user upon login.
    
    Args:
        user_id (str/int): The unique identifier of the user.
        secret_key (str, optional): The secret key for signing the token. 
                                   Defaults to app.config['SECRET_KEY'].
    
    Returns:
        str: The encoded JWT token.
    """
    if secret_key is None:
        secret_key = app.config['SECRET_KEY']

    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        'iat': datetime.datetime.utcnow()
    }

    token = jwt.encode(payload, secret_key, algorithm='HS256')
    return token