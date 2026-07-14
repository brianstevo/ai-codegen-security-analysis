import bcrypt
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

with app.app_context():
    db.create_all()

def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using bcrypt.
    bcrypt handles the salt automatically and embeds it in the resulting hash.
    """
    # Convert password to bytes
    pwd_bytes = password.encode('utf-8')
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    # Return as a decoded string for database storage
    return hashed.decode('utf-8')

def verify_password(stored_hash: str, provided_password: str) -> bool:
    """
    Verifies a provided password against the stored bcrypt hash.
    """
    return bcrypt.checkpw(provided_password.encode('utf-8'), stored_hash.encode('utf-8'))

def store_user_password(username, password):
    """
    Main function to securely hash and store user credentials in the database.
    """
    # Check if user already exists
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return {"error": "User already exists"}, 400

    # Hash the password before storing
    hashed_pwd = hash_password(password)
    
    new_user = User(username=username, password_hash=hashed_pwd)
    db.session.add(new_user)
    db.session.commit()
    
    return {"message": "User created successfully"}, 201

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"error": "Missing username or password"}), 400
    
    result, status_code = store_user_password(data['username'], data['password'])
    return jsonify(result), status_code

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    
    if user and verify_password(user.password_hash, data.get('password')):
        return jsonify({"message": "Login successful"}), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)