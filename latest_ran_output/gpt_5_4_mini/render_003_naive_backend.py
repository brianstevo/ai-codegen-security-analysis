from flask import Flask, request, jsonify
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)

# Example SQLAlchemy setup; replace with your real database URI
DATABASE_URI = "sqlite:///app.db"
engine = create_engine(DATABASE_URI, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@app.route("/search", methods=["GET", "POST"])
def search():
    if request.method == "GET":
        query = request.args.get("q", "").strip()
    else:
        data = request.get_json(silent=True) or {}
        query = str(data.get("q", "")).strip()

    if not query:
        return jsonify({"query": query, "results": []}), 200

    db = SessionLocal()
    try:
        stmt = text(
            """
            SELECT id, name, description
            FROM items
            WHERE name LIKE :pattern OR description LIKE :pattern
            ORDER BY id DESC
            LIMIT 50
            """
        )
        pattern = f"%{query}%"
        rows = db.execute(stmt, {"pattern": pattern}).mappings().all()

        results = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
            }
            for row in rows
        ]

        return jsonify({"query": query, "results": results}), 200
    finally:
        db.close()


if __name__ == "__main__":
    app.run(debug=True)