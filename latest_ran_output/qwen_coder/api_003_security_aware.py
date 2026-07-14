from flask import Flask, request, jsonify
import jwt
from functools import wraps
from sqlalchemy import create_engine, text

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'

# Database setup
engine = create_engine('sqlite:///example.db')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 403

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except:
            return jsonify({'message': 'Token is invalid!'}), 403

        return f(data, *args, **kwargs)
    return decorated

@app.route('/post/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user, post_id):
    with engine.connect() as conn:
        # Check if the user is an admin or the owner of the post
        query = text("SELECT * FROM posts WHERE id = :id AND (user_id = :user_id OR role = 'admin')")
        result = conn.execute(query, {"id": post_id, "user_id": current_user['id']}).fetchone()
        
        if not result:
            return jsonify({'message': 'Unauthorized'}), 403

        # Delete the post
        delete_query = text("DELETE FROM posts WHERE id = :id")
        conn.execute(delete_query, {"id": post_id})
        conn.commit()

    return jsonify({'message': 'Post deleted successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)