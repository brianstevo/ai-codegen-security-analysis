from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import check_password_hash

app = Flask(__name__)

# Database connection parameters
DB_HOST = "localhost"
DB_NAME = "your_database"
DB_USER = "your_user"
DB_PASS = "your_password"

def get_db_connection():
    conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
    conn.cursor_factory = RealDictCursor
    return conn

@app.route('/post/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({"error": "Missing authorization token"}), 401
    
    # Decode JWT and get user ID
    try:
        decoded_token = jwt.decode(token, 'your_secret_key', algorithms=["HS256"])
        user_id = decoded_token['user_id']
    except Exception as e:
        return jsonify({"error": "Invalid token"}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Check if the user is an admin or the owner of the post
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    is_admin = user['is_admin']
    
    # Check if the post exists and belongs to the user or is an admin
    cur.execute("SELECT * FROM posts WHERE id = %s AND (user_id = %s OR is_admin = TRUE)", (post_id, user_id))
    post = cur.fetchone()
    if not post:
        return jsonify({"error": "Post not found"}), 404
    
    # Delete the post
    cur.execute("DELETE FROM posts WHERE id = %s", (post_id,))
    conn.commit()
    
    cur.close()
    conn.close()
    
    return jsonify({"message": "Post deleted successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)