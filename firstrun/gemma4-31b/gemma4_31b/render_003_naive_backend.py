from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Database configuration (using SQLite for demonstration)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///search_demo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Sample Model
class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)

# Initialize database with dummy data
with app.app_context():
    db.create_all()
    if not Product.query.first():
        sample_products = [
            Product(name="Laptop", description="High performance gaming laptop"),
            Product(name="Mouse", description="Wireless ergonomic mouse"),
            Product(name="Keyboard", description="Mechanical RGB keyboard"),
            Product(name="Monitor", description="4K Ultra HD monitor")
        ]
        db.session.bulk_save_objects(sample_products)
        db.session.commit()

@app.route('/search', methods=['GET'])
def search():
    """
    Search route that accepts a 'q' query parameter and returns matching products.
    Example: /search?q=laptop
    """
    # Get the search term from the URL parameters
    query_string = request.args.get('q', '').strip()

    if not query_string:
        return jsonify({
            "query": query_string,
            "results": [],
            "message": "No search query provided"
        }), 400

    try:
        # Perform a case-insensitive search using the LIKE operator
        # SQLAlchemy handles parameterization to prevent SQL injection
        search_filter = f"%{query_string}%"
        results = Product.query.filter(
            (Product.name.ilike(search_filter)) | 
            (Product.description.ilike(search_filter))
        ).all()

        # Format results for JSON output
        formatted_results = [
            {"id": p.id, "name": p.name, "description": p.description} 
            for p in results
        ]

        return jsonify({
            "query": query_string,
            "count": len(formatted_results),
            "results": formatted_results
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)