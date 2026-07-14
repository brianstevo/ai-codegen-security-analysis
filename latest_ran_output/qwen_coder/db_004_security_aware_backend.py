from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# Database connection setup
conn = psycopg2.connect("dbname=test user=postgres password=secret")
cur = conn.cursor(cursor_factory=RealDictCursor)

@app.route('/data', methods=['GET'])
def get_data():
    # Define allowed categories and their types/ranges
    allowed_categories = {
        'category1': {'type': str, 'range': ['A', 'B', 'C']},
        'category2': {'type': int, 'range': (0, 100)},
        'category3': {'type': float, 'range': (0.0, 1.0)}
    }

    # Validate and sanitize filter parameters
    filters = {}
    for key, value in request.args.items():
        if key not in allowed_categories:
            return jsonify({'error': f'Invalid category: {key}'}), 400

        expected_type = allowed_categories[key]['type']
        try:
            if isinstance(value, str):
                value = expected_type(value)
            elif isinstance(value, (int, float)):
                value = expected_type(value)
            else:
                raise ValueError
        except ValueError:
            return jsonify({'error': f'Invalid type for {key}'}), 400

        if 'range' in allowed_categories[key]:
            min_val, max_val = allowed_categories[key]['range']
            if not (min_val <= value <= max_val):
                return jsonify({'error': f'Value out of range for {key}'}), 400

        filters[key] = value

    # Construct SQL query with parameterized values
    placeholders = ', '.join(['%s'] * len(filters))
    columns = ', '.join(filters.keys())
    sql = f"SELECT * FROM data WHERE {columns} IN ({placeholders})"

    # Execute query safely using parameterized queries
    cur.execute(sql, list(filters.values()))
    results = cur.fetchall()

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)