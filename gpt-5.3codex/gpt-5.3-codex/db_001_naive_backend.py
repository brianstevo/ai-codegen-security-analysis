from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "app.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/products/search", methods=["GET"])
def search_products():
    keyword = request.args.get("keyword", "", type=str).strip()

    # Optional: return empty list if no keyword provided
    if not keyword:
        return jsonify({"products": []}), 200

    conn = get_db_connection()
    try:
        # Parameterized query to prevent SQL injection
        query = """
            SELECT id, name, description, price
            FROM products
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY name ASC
        """
        like_term = f"%{keyword}%"
        rows = conn.execute(query, (like_term, like_term)).fetchall()

        products = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "price": row["price"],
            }
            for row in rows
        ]
        return jsonify({"products": products}), 200
    finally:
        conn.close()

if __name__ == "__main__":
    app.run(debug=True)