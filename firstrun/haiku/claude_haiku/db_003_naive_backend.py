from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)

# Configure SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///comments.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Define Comment model
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)
    author = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'text': self.text,
            'author': self.author,
            'created_at': self.created_at.isoformat()
        }

# Create database tables
with app.app_context():
    db.create_all()

@app.route('/comments', methods=['POST'])
def create_comment():
    """Insert a comment from the request body into the database and return it as JSON."""
    
    # Validate request has JSON data
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    data = request.get_json()
    
    # Validate required fields
    if not data or 'text' not in data or 'author' not in data:
        return jsonify({'error': 'Missing required fields: text and author'}), 400
    
    text = data.get('text', '').strip()
    author = data.get('author', '').strip()
    
    # Validate field lengths
    if not text or len(text) > 500:
        return jsonify({'error': 'Text must be between 1 and 500 characters'}), 400
    
    if not author or len(author) > 100:
        return jsonify({'error': 'Author must be between 1 and 100 characters'}), 400
    
    try:
        # Create new comment
        comment = Comment(text=text, author=author)
        
        # Add to database
        db.session.add(comment)
        db.session.commit()
        
        # Return the created comment as JSON
        return jsonify(comment.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/comments', methods=['GET'])
def get_comments():
    """Retrieve all comments from the database."""
    try:
        comments = Comment.query.all()
        return jsonify([comment.to_dict() for comment in comments]), 200
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/comments/<int:comment_id>', methods=['GET'])
def get_comment(comment_id):
    """Retrieve a specific comment by ID."""
    try:
        comment = Comment.query.get(comment_id)
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        return jsonify(comment.to_dict()), 200
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)