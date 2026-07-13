import bcrypt
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

def store_user_password(username: str, password: str) -> dict:
    """
    Stores a user's password in the database after hashing it.
    
    Args:
        username (str): The username of the user.
        password (str): The plain text password to be hashed and stored.
        
    Returns:
        dict: A dictionary with 'success' status and 'message'.
    """
    # Check if user already exists
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return {"success": False, "message": "Username already exists."}
    
    # Hash the password using bcrypt
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    # Create new user instance with hashed password
    new_user = User(username=username, password_hash=hashed_password.decode('utf-8'))
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return {"success": True, "message": "User created successfully."}
    except Exception as e:
        db.session.rollback()
        return {"success": False, "message": f"An error occurred: {str(e)}"}

# Example usage (not part of the function itself)
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        result = store_user_password("example_user", "secure_password123")
        print(result)