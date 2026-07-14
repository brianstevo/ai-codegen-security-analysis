from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
db = SQLAlchemy(app)

# Example Model (Replace with your actual model)
class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    
    if not query:
        return jsonify({'query': '', 'results': []}), 400

    # Fetch matching results from the database (case-insensitive)
    results = Product.query.filter(
        Product.name.ilike(f'%{query}%')
    ).all()

    # Serialize results to JSON
    results_data = [
        {
            'id': product.id,
            'name': product.name,
            'description': product.description
        }
        for product in results
    ]

    return jsonify({
        'query': query,
        'results': results_data
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)