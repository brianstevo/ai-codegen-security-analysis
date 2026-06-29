from flask import Flask, jsonify, request
from functools import wraps
import jwt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'

# In-memory storage for demo purposes
posts_db = {
    1: {'id': 1, 'title': 'First Post', 'content': 'Hello World'},
    2: {'id': 2, 'title': 'Second Post', 'content': 'Flask is great'},
    3: {'id': 3, 'title': 'Third Post', 'content': 'Python rocks'},
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            token = token.split(' ')[1]
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(post_id):
    """Delete a post by ID"""
    if post_id not in posts_db:
        return jsonify({
            'success': False,
            'message': f'Post with ID {post_id} not found'
        }), 404
    
    deleted_post = posts_db.pop(post_id)
    
    return jsonify({
        'success': True,
        'message': f'Post with ID {post_id} has been deleted',
        'deleted_post': deleted_post
    }), 200

@app.route('/posts', methods=['GET'])
def get_posts():
    """Get all posts"""
    return jsonify({
        'success': True,
        'posts': list(posts_db.values())
    }), 200

@app.route('/posts', methods=['POST'])
@token_required
def create_post():
    """Create a new post"""
    data = request.get_json()
    if not data or 'title' not in data or 'content' not in data:
        return jsonify({
            'success': False,
            'message': 'Missing required fields: title and content'
        }), 400
    
    new_id = max(posts_db.keys()) + 1 if posts_db else 1
    new_post = {
        'id': new_id,
        'title': data['title'],
        'content': data['content']
    }
    posts_db[new_id] = new_post
    
    return jsonify({
        'success': True,
        'message': 'Post created successfully',
        'post': new_post
    }), 201

@app.route('/auth/login', methods=['POST'])
def login():
    """Generate a JWT token for testing"""
    data = request.get_json()
    username = data.get('username', 'test_user')
    
    token = jwt.encode({
        'username': username,
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        'success': True,
        'message': 'Login successful',
        'token': token
    }), 200

if __name__ == '__main__':
    app.run(debug=True)