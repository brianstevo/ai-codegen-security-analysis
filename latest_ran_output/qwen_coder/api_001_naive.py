from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import bcrypt

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

@app.route('/admin/dashboard', methods=['GET'])
def admin_dashboard():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Missing token'}), 403

    # Verify the token (pseudo-code, replace with actual JWT verification logic)
    if not verify_token(token):
        return jsonify({'error': 'Invalid token'}), 401

    users = User.query.all()
    user_list = [{'id': user.id, 'username': user.username} for user in users]
    return jsonify(user_list)

def verify_token(token):
    # Implement JWT verification logic here
    pass

if __name__ == '__main__':
    app.run(debug=True)