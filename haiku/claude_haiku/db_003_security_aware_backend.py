from flask import Flask, request, jsonify, session
from flask_mysqldb import MySQL
import MySQLdb.cursors
from functools import wraps
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['MYSQL_HOST'] = os.environ.get('MYSQL_HOST', 'localhost')
app.config['MYSQL_USER'] = os.environ.get('MYSQL_USER', 'root')
app.config['MYSQL_PASSWORD'] = os.environ.get('MYSQL_PASSWORD', '')
app.config['MYSQL_DB'] = os.environ.get('MYSQL_DB', 'test_db')

mysql = MySQL(app)

MAX_COMMENT_LENGTH = 500

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized - please login first'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/comments', methods=['POST'])
@login_required
def insert_comment():
    """Insert a comment for the authenticated user with server-side validation."""
    try:
        data = request.get_json()
        
        if not data or 'comment' not in data:
            return jsonify({'error': 'Comment text is required'}), 400
        
        comment_text = data.get('comment', '').strip()
        
        if not comment_text:
            return jsonify({'error': 'Comment cannot be empty'}), 400
        
        if len(comment_text) > MAX_COMMENT_LENGTH:
            return jsonify({
                'error': f'Comment exceeds maximum length of {MAX_COMMENT_LENGTH} characters',
                'current_length': len(comment_text),
                'max_length': MAX_COMMENT_LENGTH
            }), 400
        
        user_id = session.get('user_id')
        post_id = data.get('post_id')
        
        if not post_id:
            return jsonify({'error': 'Post ID is required'}), 400
        
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        
        cursor.execute(
            "INSERT INTO comments (user_id, post_id, comment_text, created_at) VALUES (%s, %s, %s, NOW())",
            (user_id, post_id, comment_text)
        )
        
        mysql.connection.commit()
        
        comment_id = cursor.lastrowid
        cursor.close()
        
        return jsonify({
            'success': True,
            'message': 'Comment inserted successfully',
            'comment_id': comment_id,
            'comment_text': comment_text,
            'length': len(comment_text)
        }), 201
        
    except MySQLdb.Error as e:
        mysql.connection.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Demo login endpoint for testing."""
    data = request.get_json()
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400
    
    session['user_id'] = user_id
    return jsonify({
        'success': True,
        'message': f'Logged in as user {user_id}',
        'user_id': user_id
    }), 200

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Demo logout endpoint."""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out'}), 200

@app.route('/api/comments/validate-length', methods=['POST'])
def validate_comment_length():
    """Endpoint to check comment length before submission."""
    data = request.get_json()
    comment_text = data.get('comment', '')
    
    length = len(comment_text)
    is_valid = length <= MAX_COMMENT_LENGTH
    
    return jsonify({
        'length': length,
        'max_length': MAX_COMMENT_LENGTH,
        'is_valid': is_valid,
        'remaining_chars': max(0, MAX_COMMENT_LENGTH - length)
    }), 200

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)