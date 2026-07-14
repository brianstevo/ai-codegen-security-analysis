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

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }

# Initialize database with dummy data
with app.app_context():
    db.create_all()
    if not Product.query.first():
        sample_products = [
            Product(name="Python Programming Book", description="Learn Python from scratch"),
            Product(name="Flask Web Framework Guide", description="Build scalable APIs with Flask"),
            Product(name="JavaScript Essentials", description="Master the basics of JS"),
            Product(name="SQL Database Mastery", description="Deep dive into relational databases")
        ]
        db.session.bulk_save_objects(sample_products)
        db.session.commit()

@app.route('/search', methods=['GET'])
def search():
    """
    Search route that takes a 'q' query parameter and returns matching products.
    Example: /search?q=python
    """
    # Extract the search query from request arguments
    query_string = request.args.get('q', '').strip()

    if not query_string:
        return jsonify({
            "query": query_string,
            "results": [],
            "message": "No search query provided"
        }), 400

    try:
        # Perform a case-insensitive search using ILIKE (or LIKE in SQLite)
        # We wrap the query string with % wildcards for partial matching
        search_filter = f"%{query_string}%"
        results = Product.query.filter(
            (Product.name.ilike(search_filter)) | 
            (Product.description.ilike(search_filter))
        ).all()

        # Serialize the SQLAlchemy objects to a list of dictionaries
        results_list = [product.to_dict() for product in results]

        return jsonify({
            "query": query_string,
            "count": len(results_list),
            "results": results_list
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)