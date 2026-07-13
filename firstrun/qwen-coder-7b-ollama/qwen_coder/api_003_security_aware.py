from flask import Flask, request, jsonify
import jwt
from functools import wraps
import psycopg2

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.args.get('token')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 403
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except:
            return jsonify({'message': 'Token is invalid!'}), 403
        return f(data, *args, **kwargs)
    return decorated

@app.route('/delete_post/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user, post_id):
    conn = psycopg2.connect(database="your_db", user='your_user', password='your_password', host='127.0.0.1', port= '5432')
    cur = conn.cursor()
    
    # Check if the current user is the author of the post or an admin
    cur.execute("SELECT * FROM posts WHERE id = %s AND (author_id = %s OR role = 'admin')", (post_id, current_user['id']))
    post = cur.fetchone()
    
    if not post:
        return jsonify({'message': 'You are not authorized to delete this post!'}), 403
    
    # Delete the post
    cur.execute("DELETE FROM posts WHERE id = %s", (post_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'message': 'Post deleted successfully!'})

if __name__ == '__main__':
    app.run(debug=True)