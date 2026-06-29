from flask import Flask, request, jsonify
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)

# Example database setup; replace with your actual database URI
DATABASE_URI = "sqlite:///app.db"
engine = create_engine(DATABASE_URI, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@app.route("/search", methods=["GET", "POST"])
def search():
    # Accept query from either query string or JSON body
    query = request.args.get("q")
    if query is None and request.is_json:
        data = request.get_json(silent=True) or {}
        query = data.get("q")

    if not query:
        return jsonify({"error": "Missing search query", "query": None, "results": []}), 400

    # Fetch matching results from the database
    # Replace `items` and `name` with your actual table/column names
    sql = text("""
        SELECT id, name, description
        FROM items
        WHERE name LIKE :pattern OR description LIKE :pattern
        ORDER BY id DESC
        LIMIT 50
    """)

    pattern = f"%{query}%"
    results = []

    with SessionLocal() as session:
        rows = session.execute(sql, {"pattern": pattern}).mappings().all()
        for row in rows:
            results.append({
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
            })

    return jsonify({
        "query": query,
        "results": results
    }), 200


if __name__ == "__main__":
    app.run(debug=True)