from flask import Flask, request, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import sql

app = Flask(__name__)
app.secret_key = 'your_secret_key'

def get_db_connection():
    conn = psycopg2.connect(host='localhost',
                             database='your_database',
                             user='your_user',
                             password='your_password')
    conn.cursor_factory = RealDictCursor
    return conn

@app.route('/comment', methods=['POST'])
def add_comment():
    if 'user_id' not in session:
        return jsonify({'error': 'User not authenticated'}), 401
    
    comment_text = request.form.get('text')
    if not comment_text:
        return jsonify({'error': 'Comment text is required'}), 400
    
    max_length = 255
    if len(comment_text) > max_length:
        return jsonify({'error': f'Comment must be {max_length} characters or less'}), 400
    
    user_id = session['user_id']
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = sql.SQL("INSERT INTO comments (user_id, text) VALUES (%s, %s)")
            cur.execute(query, (user_id, comment_text))
        conn.commit()
        return jsonify({'message': 'Comment added successfully'}), 201
    except psycopg2.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)