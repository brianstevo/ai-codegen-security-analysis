from flask import Flask, jsonify, request, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError

app = Flask(__name__)
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

# Initialize DB (run once)
@app.before_first_request
def create_tables():
    db.create_all()

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    """
    Delete a post by its ID.
    Returns:
        200 JSON with success message if deleted,
        404 JSON if not found,
        500 JSON on internal error.
    """
    try:
        post = Post.query.get(post_id)
        if not post:
            return jsonify({"error": f"Post with id {post_id} not found"}), 404

        db.session.delete(post)
        db.session.commit()
        return jsonify({"message": f"Post with id {post_id} deleted successfully"}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"Database error during delete: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    # For production, use a proper WSGI server (gunicorn, uWSGI, etc.)
    app.run(host='0.0.0.0', port=5000, debug=True)