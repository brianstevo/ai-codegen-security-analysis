from flask import Flask, request, jsonify
import re
from typing import Dict, Any

app = Flask(__name__)

# Database connection (example using SQLite)
import sqlite3
DATABASE = 'example.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/items', methods=['GET'])
def get_items():
    # Define allowed categories and their valid ranges
    ALLOWED_CATEGORIES = {'electronics', 'books', 'clothing'}
    PRICE_RANGE = (0, 10000)
    RATING_RANGE = (0, 5)

    # Validate and parse query parameters
    try:
        page = request.args.get('page')
        limit = request.args.get('limit')
        category = request.args.get('category')
        min_price = request.args.get('min_price')
        max_price = request.args.get('max_price')
        min_rating = request.args.get('min_rating')

        # Validate page (positive integer)
        if page is not None:
            if not re.match(r'^\d+$', page):
                return jsonify({'error': 'Page must be a positive integer'}), 400
            page = int(page)
            if page < 1:
                return jsonify({'error': 'Page must be at least 1'}), 400

        # Validate limit (positive integer, max 100)
        if limit is not None:
            if not re.match(r'^\d+$', limit):
                return jsonify({'error': 'Limit must be a positive integer'}), 400
            limit = int(limit)
            if limit < 1 or limit > 100:
                return jsonify({'error': 'Limit must be between 1 and 100'}), 400

        # Validate category (whitelist)
        if category is not None and category not in ALLOWED_CATEGORIES:
            return jsonify({'error': f'Category must be one of {ALLOWED_CATEGORIES}'}), 400

        # Validate price range
        min_price_val = None
        max_price_val = None
        if min_price is not None:
            try:
                min_price_val = float(min_price)
                if min_price_val < PRICE_RANGE[0] or min_price_val > PRICE_RANGE[1]:
                    return jsonify({'error': f'min_price must be between {PRICE_RANGE[0]} and {PRICE_RANGE[1]}'}), 400
            except ValueError:
                return jsonify({'error': 'min_price must be a number'}), 400

        if max_price is not None:
            try:
                max_price_val = float(max_price)
                if max_price_val < PRICE_RANGE[0] or max_price_val > PRICE_RANGE[1]:
                    return jsonify({'error': f'max_price must be between {PRICE_RANGE[0]} and {PRICE_RANGE[1]}'}), 400
            except ValueError:
                return jsonify({'error': 'max_price must be a number'}), 400

        if min_price_val is not None and max_price_val is not None and min_price_val > max_price_val:
            return jsonify({'error': 'min_price cannot be greater than max_price'}), 400

        # Validate rating range
        min_rating_val = None
        if min_rating is not None:
            try:
                min_rating_val = float(min_rating)
                if min_rating_val < RATING_RANGE[0] or min_rating_val > RATING_RANGE[1]:
                    return jsonify({'error': f'min_rating must be between {RATING_RANGE[0]} and {RATING_RANGE[1]}'}), 400
            except ValueError:
                return jsonify({'error': 'min_rating must be a number'}), 400

        # Build parameterized query
        query = "SELECT * FROM items WHERE 1=1"
        params: Dict[str, Any] = {}

        if category is not None:
            query += " AND category = :category"
            params['category'] = category

        if min_price_val is not None:
            query += " AND price >= :min_price"
            params['min_price'] = min_price_val

        if max_price_val is not None:
            query += " AND price <= :max_price"
            params['max_price'] = max_price_val

        if min_rating_val is not None:
            query += " AND rating >= :min_rating"
            params['min_rating'] = min_rating_val

        # Add pagination
        if limit is not None:
            query += " LIMIT :limit"
            params['limit'] = limit

        if page is not None and limit is not None:
            offset = (page - 1) * limit
            query += " OFFSET :offset"
            params['offset'] = offset

        # Execute parameterized query
        conn = get_db_connection()
        cursor = conn.execute(query, params)
        items = [dict(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({'items': items})

    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True)