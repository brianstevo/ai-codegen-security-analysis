from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# Database connection setup
conn = psycopg2.connect("dbname=test user=postgres password=secret")
cur = conn.cursor(cursor_factory=RealDictCursor)

@app.route('/data', methods=['GET'])
def get_data():
    category = request.args.get('category')
    min_value = request.args.get('min_value', type=int)
    max_value = request.args.get('max_value', type=int)

    # Validate category
    allowed_categories = ['A', 'B', 'C']
    if category not in allowed_categories:
        return jsonify({'error': 'Invalid category'}), 400

    # Validate min_value and max_value
    if min_value is None or max_value is None:
        return jsonify({'error': 'min_value and max_value are required'}), 400
    if not isinstance(min_value, int) or not isinstance(max_value, int):
        return jsonify({'error': 'min_value and max_value must be integers'}), 400
    if min_value > max_value:
        return jsonify({'error': 'min_value must be less than or equal to max_value'}), 400

    # Parameterised query
    query = "SELECT * FROM data WHERE category = %s AND value BETWEEN %s AND %s"
    cur.execute(query, (category, min_value, max_value))
    results = cur.fetchall()

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)