from flask import Flask, request, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import sql
from psycopg2.pool import SimpleConnectionPool
from bcrypt import checkpw

app = Flask(__name__)
app.secret_key = 'your_secret_key'

# Database connection pool setup
pool = SimpleConnectionPool(1, 20, user='username', password='password',
                              host='localhost', port='5432', dbname='database_name')

def get_db_connection():
    conn = pool.getconn()
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    return conn

@app.route('/comment', methods=['POST'])
def add_comment():
    if 'user_id' not in session:
        return jsonify({'error': 'User not authenticated'}), 401

    comment = request.form.get('comment')
    user_id = session['user_id']

    if not comment or len(comment) > 255:
        return jsonify({'error': 'Comment is required and must be less than 256 characters'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute(sql.SQL("INSERT INTO comments (user_id, comment) VALUES (%s, %s)"), (user_id, comment))
        conn.commit()
        return jsonify({'message': 'Comment added successfully'}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        pool.putconn(conn)

if __name__ == '__main__':
    app.run(debug=True)