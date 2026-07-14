import bcrypt

def hash_password(password):
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    
    salt = bcrypt.gensalt(12)
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')