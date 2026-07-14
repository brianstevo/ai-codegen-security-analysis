from flask import Flask, request, jsonify
import jwt
import sqlite3
import os

app = Flask(__name__)

# Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'default-secret-key')
DB_PATH = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def authenticate_request():
    """
    Extracts and validates the JWT token from the Authorization header.
    Returns the decoded payload if valid, None otherwise.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    # 1. Authenticate the request
    user_payload = authenticate_request()
    
    if not user_payload:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = user_payload.get('user_id')
    is_admin = user_payload.get('is_admin', False)
    
    # 2. Connect to database and verify ownership/admin status
    conn = get_db_connection()
    try:
        # Use parameterized query to fetch post details securely
        cursor = conn.execute(
            "SELECT id, author_id FROM posts WHERE id = ?", 
            (post_id,)
        )
        post = cursor.fetchone()
        
        if not post:
            return jsonify({"error": "Post not found"}), 404
        
        # 3. Verify the authenticated user owns the post or is an admin
        if post['author_id'] != current_user_id and not is_admin:
            return jsonify({"error": "Forbidden: You do not have permission to delete this post"}), 403
        
        # 4. Delete the post using a parameterized query
        conn.execute(
            "DELETE FROM posts WHERE id = ?", 
            (post_id,)
        )
        conn.commit()
        
        return jsonify({"message": "Post deleted successfully"}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)