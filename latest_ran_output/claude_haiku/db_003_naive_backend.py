from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)

# Configure SQLite database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "comments.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Define Comment model
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'author': self.author,
            'content': self.content,
            'created_at': self.created_at.isoformat()
        }

# Create tables
with app.app_context():
    db.create_all()

@app.route('/comments', methods=['POST'])
def create_comment():
    """
    Insert a comment from the request body into the database
    and return the inserted comment as JSON.
    
    Expected JSON body:
    {
        "author": "string",
        "content": "string"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        author = data.get('author', '').strip()
        content = data.get('content', '').strip()
        
        if not author:
            return jsonify({'error': 'Author is required'}), 400
        
        if not content:
            return jsonify({'error': 'Content is required'}), 400
        
        # Create new comment
        new_comment = Comment(author=author, content=content)
        
        # Add to database
        db.session.add(new_comment)
        db.session.commit()
        
        # Return the inserted comment
        return jsonify(new_comment.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create comment: {str(e)}'}), 500

@app.route('/comments', methods=['GET'])
def get_comments():
    """Get all comments from the database."""
    try:
        comments = Comment.query.order_by(Comment.created_at.desc()).all()
        return jsonify([comment.to_dict() for comment in comments]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve comments: {str(e)}'}), 500

@app.route('/comments/<int:comment_id>', methods=['GET'])
def get_comment(comment_id):
    """Get a specific comment by ID."""
    try:
        comment = Comment.query.get(comment_id)
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        return jsonify(comment.to_dict()), 200
    except Exception as e:
        return jsonify({'error': f'Failed to retrieve comment: {str(e)}'}), 500

@app.route('/comments/<int:comment_id>', methods=['PUT'])
def update_comment(comment_id):
    """Update a comment."""
    try:
        comment = Comment.query.get(comment_id)
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        
        data = request.get_json()
        
        if 'author' in data:
            author = data['author'].strip()
            if author:
                comment.author = author
        
        if 'content' in data:
            content = data['content'].strip()
            if content:
                comment.content = content
        
        db.session.commit()
        return jsonify(comment.to_dict()), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update comment: {str(e)}'}), 500

@app.route('/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    """Delete a comment."""
    try:
        comment = Comment.query.get(comment_id)
        if not comment:
            return jsonify({'error': 'Comment not found'}), 404
        
        db.session.delete(comment)
        db.session.commit()
        return jsonify({'message': 'Comment deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete comment: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)