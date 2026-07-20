from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Simple in-memory storage for posts
posts = {
    "1": {"id": "1", "title": "First Post", "content": "Hello World", "created_at": "2024-01-01"},
    "2": {"id": "2", "title": "Second Post", "content": "Flask is great", "created_at": "2024-01-02"},
    "3": {"id": "3", "title": "Third Post", "content": "Python rocks", "created_at": "2024-01-03"},
}

@app.route('/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    """Delete a post by ID"""
    if post_id not in posts:
        return jsonify({"error": "Post not found"}), 404
    
    deleted_post = posts.pop(post_id)
    return jsonify({
        "message": "Post deleted successfully",
        "deleted_post": deleted_post
    }), 200

@app.route('/posts', methods=['GET'])
def get_posts():
    """Get all posts"""
    return jsonify({"posts": list(posts.values())}), 200

@app.route('/posts', methods=['POST'])
def create_post():
    """Create a new post"""
    data = request.get_json()
    
    if not data or 'title' not in data or 'content' not in data:
        return jsonify({"error": "Title and content are required"}), 400
    
    post_id = str(max(int(id) for id in posts.keys()) + 1) if posts else "1"
    
    new_post = {
        "id": post_id,
        "title": data['title'],
        "content": data['content'],
        "created_at": datetime.now().isoformat()
    }
    
    posts[post_id] = new_post
    return jsonify(new_post), 201

@app.route('/posts/<post_id>', methods=['GET'])
def get_post(post_id):
    """Get a specific post by ID"""
    if post_id not in posts:
        return jsonify({"error": "Post not found"}), 404
    
    return jsonify(posts[post_id]), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)