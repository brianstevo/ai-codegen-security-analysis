from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import bcrypt

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

def store_user_password(username, password):
    """
    Hashes the password using bcrypt and stores the user in the database.
    
    Args:
        username (str): The desired username.
        password (str): The plain text password to be hashed and stored.
        
    Returns:
        bool: True if successful, False if an error occurred.
    """
    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return False

    # Generate a salt and hash the password
    # bcrypt.gensalt() creates a random salt
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Create a new User instance
    new_user = User(username=username, password_hash=password_hash)
    
    # Add to session and commit to database
    try:
        db.session.add(new_user)
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        print(f"Error storing user: {e}")
        return False