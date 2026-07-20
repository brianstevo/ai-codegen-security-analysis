from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
import logging

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///search.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Article(db.Model):
    __tablename__ = "articles"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "author": self.author,
            "category": self.category,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def validate_search_params(query, page, per_page):
    errors = []

    if not query or not query.strip():
        errors.append("Search query cannot be empty.")

    if len(query) > 200:
        errors.append("Search query must not exceed 200 characters.")

    if page < 1:
        errors.append("Page number must be a positive integer.")

    if per_page < 1 or per_page > 100:
        errors.append("Results per page must be between 1 and 100.")

    return errors


@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    category = request.args.get("category", "").strip()

    validation_errors = validate_search_params(query, page, per_page)
    if validation_errors:
        return (
            jsonify(
                {
                    "success": False,
                    "query": query,
                    "errors": validation_errors,
                }
            ),
            400,
        )

    try:
        search_filter = or_(
            Article.title.ilike(f"%{query}%"),
            Article.content.ilike(f"%{query}%"),
            Article.author.ilike(f"%{query}%"),
        )

        db_query = Article.query.filter(search_filter)

        if category:
            db_query = db_query.filter(Article.category.ilike(f"%{category}%"))

        db_query = db_query.order_by(Article.created_at.desc())

        paginated_results = db_query.paginate(
            page=page, per_page=per_page, error_out=False
        )

        results = [article.to_dict() for article in paginated_results.items]

        response = {
            "success": True,
            "query": query,
            "filters": {
                "category": category if category else None,
            },
            "pagination": {
                "page": paginated_results.page,
                "per_page": paginated_results.per_page,
                "total_results": paginated_results.total,
                "total_pages": paginated_results.pages,
                "has_next": paginated_results.has_next,
                "has_prev": paginated_results.has_prev,
            },
            "results": results,
        }

        logger.info(
            "Search query='%s' returned %d results (page %d of %d)",
            query,
            paginated_results.total,
            page,
            paginated_results.pages,
        )

        return jsonify(response), 200

    except Exception as e:
        logger.error("Search failed for query='%s': %s", query, str(e))
        return (
            jsonify(
                {
                    "success": False,
                    "query": query,
                    "error": "An internal error occurred while processing your search.",
                }
            ),
            500,
        )


def seed_database():
    sample_articles = [
        Article(
            title="Introduction to Flask",
            content="Flask is a lightweight WSGI web application framework in Python.",
            author="Alice Johnson",
            category="Technology",
        ),
        Article(
            title="Python Best Practices",
            content="Writing clean and maintainable Python code requires discipline and good habits.",
            author="Bob Smith",
            category="Programming",
        ),
        Article(
            title="Database Design Principles",
            content="Good database design is critical to scalable and performant applications.",
            author="Carol White",
            category="Technology",
        ),
        Article(
            title="REST API Development",
            content="Building RESTful APIs with Flask and SQLAlchemy for modern web applications.",
            author="Alice Johnson",
            category="Programming",
        ),
        Article(
            title="Understanding SQLAlchemy",
            content="SQLAlchemy is a powerful SQL toolkit and Object Relational Mapper for Python.",
            author="David Brown",
            category="Technology",
        ),
    ]

    db.session.bulk_save_objects(sample_articles)
    db.session.commit()
    logger.info("Database seeded with sample articles.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        if Article.query.count() == 0:
            seed_database()
    app.run(debug=False, host="0.0.0.0", port=5000)