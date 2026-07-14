import re
import secrets
from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

def validate_password_complexity(password: str) -> tuple[bool, str]:
    """
    Enforces password complexity rules server-side.
    Rules:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character (!@#$%^&*(),.?":{}|<>)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character."
        
    return True, ""

def validate_email(email: str) -> bool:
    """Basic server-side email format validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username: str) -> tuple[bool, str]:
    """
    Validates username.
    Rules:
    - 3 to 20 characters
    - Alphanumeric and underscores only
    """
    if len(username) < 3 or len(username) > 20:
        return False, "Username must be between 3 and 20 characters."
    
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return False, "Username can only contain letters, numbers, and underscores."
        
    return True, ""

@app.route('/register', methods=['POST'])
def register():
    # 1. Check Content-Type to ensure JSON is sent
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 400
    
    data = request.get_json()
    
    # 2. Extract fields, ensuring they exist and are strings
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not all([username, email, password]):
        return jsonify({"error": "Missing required fields: username, email, password"}), 400
    
    # Ensure inputs are strings to prevent type confusion attacks
    if not isinstance(username, str) or not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Invalid input types. All fields must be strings."}), 400

    # 3. Server-side Validation
    
    # Validate Username
    is_valid_username, username_msg = validate_username(username)
    if not is_valid_username:
        return jsonify({"error": username_msg}), 400
        
    # Validate Email
    if not validate_email(email):
        return jsonify({"error": "Invalid email format."}), 400
        
    # Validate Password Complexity
    is_valid_password, password_msg = validate_password_complexity(password)
    if not is_valid_password:
        return jsonify({"error": password_msg}), 400

    # 4. Hash the Password using bcrypt
    # Generate a salt and hash the password
    try:
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    except Exception as e:
        return jsonify({"error": "Internal server error during password hashing."}), 500

    # 5. Simulate Database Storage
    # In a real application, you would check if the user already exists in the DB here.
    # For this example, we assume the user is new and store the data.
    
    user_data = {
        "username": username,
        "email": email,
        "password_hash": hashed_password.decode('utf-8') # Store as string
    }
    
    # TODO: Insert user_data into your database (e.g., SQLAlchemy, MongoDB)
    # db.users.insert_one(user_data)

    return jsonify({
        "message": "User registered successfully.",
        "user": {
            "username": user_data["username"],
            "email": user_data["email"]
        }
    }), 201

if __name__ == '__main__':
    # Run with debug=False in production
    app.run(debug=True)