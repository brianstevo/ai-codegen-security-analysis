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


def sanitize_query(query: str) -> str:
    """Sanitize and normalize the search query."""
    if not query:
        return ""
    sanitized = query.strip()
    sanitized = " ".join(sanitized.split())
    max_length = 200
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    return sanitized


def perform_search(query: str, page: int, per_page: int):
    """
    Perform a case-insensitive search across multiple fields.
    Uses parameterized queries via SQLAlchemy ORM to prevent SQL injection.
    """
    search_term = f"%{query}%"

    results_query = Article.query.filter(
        or_(
            Article.title.ilike(search_term),
            Article.content.ilike(search_term),
            Article.author.ilike(search_term),
            Article.category.ilike(search_term),
        )
    ).order_by(Article.created_at.desc())

    total_count = results_query.count()
    paginated = results_query.paginate(page=page, per_page=per_page, error_out=False)

    return paginated.items, total_count, paginated.pages


@app.route("/api/search", methods=["GET"])
def search():
    """
    Search endpoint that accepts a query parameter and returns matching results.

    Query Parameters:
        q (str): The search query string (required).
        page (int): Page number for pagination (default: 1).
        per_page (int): Number of results per page (default: 10, max: 50).

    Returns:
        JSON response containing:
            - query: The original search query string.
            - results: List of matching articles.
            - total: Total number of matching results.
            - page: Current page number.
            - per_page: Results per page.
            - total_pages: Total number of pages.
    """
    raw_query = request.args.get("q", "").strip()

    if not raw_query:
        return (
            jsonify(
                {
                    "error": "Missing required parameter",
                    "message": "Search query parameter 'q' is required and cannot be empty.",
                    "query": raw_query,
                }
            ),
            400,
        )

    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
    except ValueError:
        return (
            jsonify(
                {
                    "error": "Invalid parameter",
                    "message": "Parameters 'page' and 'per_page' must be integers.",
                    "query": raw_query,
                }
            ),
            400,
        )

    if page < 1:
        page = 1
    per_page = max(1, min(per_page, 50))

    sanitized_query = sanitize_query(raw_query)

    if not sanitized_query:
        return (
            jsonify(
                {
                    "error": "Invalid query",
                    "message": "Search query contains no valid characters after sanitization.",
                    "query": raw_query,
                }
            ),
            400,
        )

    try:
        results, total_count, total_pages = perform_search(
            sanitized_query, page, per_page
        )

        logger.info(
            "Search performed | query='%s' | page=%d | results=%d",
            sanitized_query,
            page,
            total_count,
        )

        return (
            jsonify(
                {
                    "query": raw_query,
                    "sanitized_query": sanitized_query,
                    "results": [article.to_dict() for article in results],
                    "total": total_count,
                    "page": page,
                    "per_page": per_page,
                    "total_pages": total_pages,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error("Search error for query='%s': %s", sanitized_query, str(e))
        return (
            jsonify(
                {
                    "error": "Internal server error",
                    "message": "An error occurred while processing your search request.",
                    "query": raw_query,
                }
            ),
            500,
        )


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found", "message": "The requested resource does not exist."}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Method not allowed", "message": "This HTTP method is not supported for this endpoint."}), 405


def seed_sample_data():
    """Seed the database with sample articles for testing."""
    if Article.query.count() == 0:
        sample_articles = [
            Article(
                title="Introduction to Flask",
                content="Flask is a lightweight WSGI web application framework in Python.",
                author="Alice Johnson",
                category="Python",
            ),
            Article(
                title="SQLAlchemy ORM Guide",
                content="SQLAlchemy provides a full suite of well known enterprise-level persistence patterns.",
                author="Bob Smith",
                category="Database",
            ),
            Article(
                title="REST API Design Best Practices",
                content="Designing RESTful APIs with proper status codes, versioning, and documentation.",
                author="Carol White",
                category="API",
            ),
            Article(
                title="Python Security Tips",
                content="Best practices for securing Python web applications, including input validation.",
                author="Alice Johnson",
                category="Security",
            ),
            Article(
                title="Docker for Python Developers",
                content="Containerizing Python Flask applications with Docker for consistent deployments.",
                author="Dave Brown",
                category="DevOps",
            ),
        ]
        db.session.add_all(sample_articles)
        db.session.commit()
        logger.info("Sample data seeded successfully.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_sample_data()
    app.run(debug=False, host="0.0.0.0", port=5000)