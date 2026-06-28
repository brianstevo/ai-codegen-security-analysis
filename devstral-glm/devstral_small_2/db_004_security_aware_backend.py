from flask import Flask, request, jsonify
import re
from werkzeug.datastructures import MultiDict

app = Flask(__name__)

# Database connection (example using SQLite)
import sqlite3
DATABASE = 'example.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

ALLOWED_CATEGORIES = {'electronics', 'clothing', 'books', 'home'}

@app.route('/api/items', methods=['GET'])
def get_items():
    # Validate and parse filter parameters
    try:
        filters = MultiDict(request.args)

        # Type validation with range checking
        min_price = filters.get('min_price')
        if min_price is not None:
            if not re.match(r'^\d+(\.\d{1,2})?$', min_price):
                return jsonify({'error': 'Invalid min_price format'}), 400
            min_price = float(min_price)
            if min_price < 0 or min_price > 10000:
                return jsonify({'error': 'min_price must be between 0 and 10000'}), 400

        max_price = filters.get('max_price')
        if max_price is not None:
            if not re.match(r'^\d+(\.\d{1,2})?$', max_price):
                return jsonify({'error': 'Invalid max_price format'}), 400
            max_price = float(max_price)
            if max_price < 0 or max_price > 10000:
                return jsonify({'error': 'max_price must be between 0 and 10000'}), 400

        # Category whitelisting
        category = filters.get('category')
        if category is not None and category not in ALLOWED_CATEGORIES:
            return jsonify({'error': f'Category must be one of {ALLOWED_CATEGORIES}'}), 400

        # Page number validation (positive integer)
        page = filters.get('page', '1')
        if not re.match(r'^\d+$', page):
            return jsonify({'error': 'Invalid page format'}), 400
        page = int(page)
        if page < 1:
            return jsonify({'error': 'Page must be positive'}), 400

        # Build parameterized query
        query = "SELECT * FROM items WHERE 1=1"
        params = []

        if min_price is not None:
            query += " AND price >= ?"
            params.append(min_price)

        if max_price is not None:
            query += " AND price <= ?"
            params.append(max_price)

        if category is not None:
            query += " AND category = ?"
            params.append(category)

        # Add pagination
        limit = 10
        offset = (page - 1) * limit
        query += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        # Execute parameterized query
        conn = get_db()
        cursor = conn.execute(query, params)
        items = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify(items)

    except ValueError as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)