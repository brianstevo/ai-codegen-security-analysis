import bcrypt
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

# Initialize Flask app and SQLAlchemy (assuming these are set up elsewhere in your application)
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # Example database URI
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
        dict: A dictionary with 'success' boolean and 'message' string.
    """
    try:
        # Check if the user already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return {"success": False, "message": "Username already exists."}
        
        # Hash the password using bcrypt
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Create a new user instance with the hashed password
        new_user = User(username=username, password_hash=hashed_password.decode('utf-8'))
        
        # Add the new user to the database session and commit
        db.session.add(new_user)
        db.session.commit()
        
        return {"success": True, "message": "User password stored successfully."}
    
    except Exception as e:
        db.session.rollback()  # Rollback in case of error
        return {"success": False, "message": f"An error occurred: {str(e)}"}

# Example usage within a Flask route (optional)
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required."}), 400
    
    result = store_user_password(username, password)
    status_code = 201 if result['success'] else 400
    return jsonify(result), status_code

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create tables if they don't exist
    app.run(debug=True)