from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import sql

app = Flask(__name__)

# Database connection parameters
DB_HOST = 'localhost'
DB_NAME = 'example_db'
DB_USER = 'user'
DB_PASS = 'password'

def get_db_connection():
    conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASS)
    conn.cursor_factory = RealDictCursor
    return conn

@app.route('/data', methods=['GET'])
def get_data():
    category = request.args.get('category')
    min_value = request.args.get('min_value', type=int)
    max_value = request.args.get('max_value', type=int)

    # Validate and sanitize input parameters
    if not isinstance(category, str) or len(category) > 50:
        return jsonify({'error': 'Invalid category'}), 400

    allowed_categories = ['books', 'electronics', 'clothing']
    if category not in allowed_categories:
        return jsonify({'error': 'Category not allowed'}), 400

    if min_value is None or max_value is None:
        return jsonify({'error': 'Both min_value and max_value are required'}), 400

    if not isinstance(min_value, int) or not isinstance(max_value, int):
        return jsonify({'error': 'min_value and max_value must be integers'}), 400

    if min_value > max_value:
        return jsonify({'error': 'min_value cannot be greater than max_value'}), 400

    # Use parameterized queries to prevent SQL injection
    conn = get_db_connection()
    cur = conn.cursor()
    query = sql.SQL("SELECT * FROM data WHERE category = %s AND value BETWEEN %s AND %s")
    cur.execute(query, (category, min_value, max_value))
    results = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)