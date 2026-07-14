from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import bcrypt

# Initialize Flask app and database configuration
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Define the User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

# Create the database tables within the application context
with app.app_context():
    db.create_all()

def store_user_password(username, password):
    """
    Hashes the password using bcrypt and stores the user in the database.
    
    Args:
        username (str): The desired username.
        password (str): The plain text password to be hashed.
        
    Returns:
        User: The created User object.
    """
    # Generate a salt and hash the password
    # bcrypt.gensalt() creates a salt with the default work factor (12)
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Create a new User instance
    new_user = User(username=username, password_hash=hashed_password)
    
    # Add to the session and commit to the database
    db.session.add(new_user)
    db.session.commit()
    
    return new_user