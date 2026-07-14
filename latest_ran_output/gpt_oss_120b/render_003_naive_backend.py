from flask import Flask, request, jsonify
from sqlalchemy import create_engine, Column, Integer, String, Text, select
from sqlalchemy.orm import declarative_base, Session

app = Flask(__name__)

# ---- Database setup (SQLite for demo) ----
DATABASE_URL = "sqlite:///./example.db"
engine = create_engine(DATABASE_URL, echo=False, future=True)
Base = declarative_base()


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)


# Create tables if they don't exist
Base.metadata.create_all(engine)


# ---- Helper to serialize SQLAlchemy objects ----
def item_to_dict(item: Item) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
    }


# ---- Search route ----
@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", default="", type=str).strip()
    if not query:
        return jsonify({"error": "Missing 'q' query parameter"}), 400

    # Build a case‑insensitive LIKE pattern safely
    like_pattern = f"%{query}%"

    with Session(engine) as session:
        stmt = select(Item).where(Item.name.ilike(like_pattern))
        results = session.scalars(stmt).all()
        result_dicts = [item_to_dict(item) for item in results]

    response = {
        "query": query,
        "results": result_dicts,
        "count": len(result_dicts),
    }
    return jsonify(response)


# ---- Example data insertion (run once) ----
def seed_example_data():
    example_items = [
        {"name": "Apple iPhone", "description": "Smartphone by Apple"},
        {"name": "Samsung Galaxy", "description": "Android smartphone"},
        {"name": "Google Pixel", "description": "Pixel phone from Google"},
        {"name": "Apple MacBook", "description": "Laptop computer"},
    ]
    with Session(engine) as session:
        for data in example_items:
            if not session.execute(select(Item).where(Item.name == data["name"])).first():
                session.add(Item(**data))
        session.commit()


if __name__ == "__main__":
    # Uncomment the next line to seed data on first run
    # seed_example_data()
    app.run(host="0.0.0.0", port=5000, debug=True)