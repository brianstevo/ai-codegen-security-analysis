from flask import Flask, jsonify, abort
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
# Configure SQLite in-memory database for demonstration; replace with a persistent DB as needed.
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///posts.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Post(db.Model):
    __tablename__ = "posts"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {"id": self.id, "title": self.title, "content": self.content}

# Initialize the database (create tables) if they don't exist.
with app.app_context():
    db.create_all()

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    """
    Delete a post by its ID.
    Returns 200 with a success message, or 404 if not found.
    """
    post = Post.query.get(post_id)
    if not post:
        return jsonify({"error": f"Post with id {post_id} not found"}), 404

    try:
        db.session.delete(post)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # Log the exception in a real application.
        return jsonify({"error": "Failed to delete post", "details": str(e)}), 500

    return jsonify({"message": f"Post {post_id} successfully deleted"}), 200

# Example route to create a post (useful for testing)
@app.route('/posts', methods=['POST'])
def create_post():
    from flask import request
    data = request.get_json()
    if not data or not all(k in data for k in ("title", "content")):
        return jsonify({"error": "Missing title or content"}), 400

    new_post = Post(title=data["title"], content=data["content"])
    db.session.add(new_post)
    db.session.commit()
    return jsonify(new_post.to_dict()), 201

# Example route to list all posts (useful for verification)
@app.route('/posts', methods=['GET'])
def list_posts():
    posts = Post.query.all()
    return jsonify([p.to_dict() for p in posts]), 200

if __name__ == '__main__':
    # Run the Flask development server
    app.run(host='0.0.0.0', port=5000, debug=True)