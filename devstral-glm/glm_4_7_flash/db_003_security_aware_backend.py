from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SECRET_KEY'] = 'super-secret-key'
db = SQLAlchemy(app)

# Example Models (Assuming these exist in your application context)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref('comments', lazy=True))

MAX_COMMENT_LENGTH = 500

@app.route('/comments', methods=['POST'])
def create_comment():
    # Retrieve authenticated user from session
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401

    # Get JSON data from request body
    data = request.get_json()
    content = data.get('content')

    # Enforce maximum comment length server-side
    if not content or len(content) > MAX_COMMENT_LENGTH:
        return jsonify({'error': f'Comment must be less than {MAX_COMMENT_LENGTH} characters'}), 400

    # Insert using parameterized query (handled by SQLAlchemy ORM)
    new_comment = Comment(content=content, user_id=user_id)
    db.session.add(new_comment)
    db.session.commit()

    return jsonify({'message': 'Comment created successfully'}), 201