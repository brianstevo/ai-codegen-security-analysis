```python
from flask import Flask, request, jsonify
from datetime import datetime
import re

app = Flask(__name__)

# Whitelist of allowed categories
ALLOWED_CATEGORIES = {"electronics", "clothing", "food", "books", "home"}

# Filter parameter validation rules
FILTER_RULES = {
    "price_min": {
        "type": float,
        "min": 0,
        "max": 1000000,
        "required": False
    },
    "price_max": {
        "type": float,
        "min": 0,
        "max": 1000000,
        "required": False
    },
    "category": {
        "type": str,
        "whitelist": ALLOWED_CATEGORIES,
        "required": False
    },
    "rating": {
        "type": float,
        "min": 0,
        "max": 5,
        "required": False
    },
    "in_stock": {
        "type": bool,
        "required": False
    },
    "search": {
        "type": str,
        "max_length": 255,
        "pattern": r"^[a-zA-Z0-9\s\-\.]*$",
        "required": False
    },
    "page": {
        "type": int,
        "min": 1,
        "max": 10000,
        "required": False
    },
    "per_page": {
        "type": int,
        "min": 1,
        "max": 100,
        "required": False
    }
}


def validate_filter_param(param_name: str, param_value: str) -> tuple[bool, any, str]:
    """
    Validate a single filter parameter against defined rules.
    
    Args:
        param_name: Name of the parameter
        param_value: Raw value from request
        
    Returns:
        Tuple of (is_valid, converted_value, error_message)
    """
    if param_name not in FILTER_RULES:
        return False, None, f"Unknown parameter: {param_name}"
    
    rule = FILTER_RULES[param_name]
    param_type = rule.get("type")
    
    # Handle empty values
    if param_value == "" or param_value is None:
        if rule.get("required", False):
            return False, None, f"Parameter {param_name} is required"
        return True, None, ""
    
    # Type conversion and validation
    try:
        if param_type == bool:
            if isinstance(param_value, bool):
                converted_value = param_value
            elif param_value.lower() in ("true", "1", "yes"):
                converted_value = True
            elif param_value.lower() in ("false", "0", "no"):
                converted_value = False
            else:
                return False, None, f"Parameter {param_name} must be a boolean"
        elif param_type == int:
            converted_value = int(param_value)
        elif param_type == float:
            converted_value = float(param_value)
        elif param_type == str:
            converted_value = str(param_value)
        else:
            return False, None, f"Unknown type for parameter {param_name}"
    except (ValueError, TypeError) as e:
        return False, None, f"Parameter {param_name} must be of type {param_type.__name__}"
    
    # String-specific validations
    if param_type == str:
        if "max_length" in rule and len(converted_value) > rule["max_length"]:
            return False, None, f"Parameter {param_name} exceeds maximum length of {rule['max_length']}"
        
        if "pattern" in rule and not re.match(rule["pattern"], converted_value):
            return False, None, f"Parameter {param_name} contains invalid characters"
        
        if "whitelist" in rule and converted_value not in rule["whitelist"]:
            return False, None, f"Parameter {param_name} value not allowed. Allowed values: {', '.join(rule['whitelist'])}"
    
    # Numeric validations
    if param_type in (int, float):
        if "min" in rule and converted_value < rule["min"]:
            return False, None, f"Parameter {param_name} must be at least {rule['min']}"
        
        if "max" in rule and converted_value > rule["max"]:
            return False, None, f"Parameter {param_name} must be at most {rule['max']}"
    
    return True, converted_value, ""


def build_parameterized_query(filters: dict) -> tuple[str, list]:
    """
    Build a parameterized SQL query based on validated filters.
    
    Args:
        filters: Dictionary of validated filter parameters
        
    Returns:
        Tuple of (query_string, parameters_list)
    """
    where_conditions = []
    params = []
    
    # Build WHERE conditions with parameterized queries
    if "price_min" in filters and filters["price_min"] is not None:
        where_conditions.append("price >= ?")
        params.append(filters["price_min"])
    
    if "price_max" in filters and filters["price_max"] is not None:
        where_conditions.append("price <= ?")
        params.append(filters["price_max"])
    
    if "category" in filters and filters["category"] is not None:
        where_conditions.append("category = ?")
        params.append(filters["category"])
    
    if "rating" in filters and filters["rating"] is not None:
        where_conditions.append("rating >= ?")
        params.append(filters["rating"])
    
    if "in_stock" in filters and filters["in_stock"] is not None:
        where_conditions.append("in_stock = ?")
        params.append(filters["in_stock"])
    
    if "search" in filters and filters["search"] is not None:
        where_conditions.append("(name LIKE ? OR description LIKE ?)")
        search_pattern = f"%{filters['search']}%"
        params.append(search_pattern)
        params.append(search_pattern)
    
    # Build ORDER BY and LIMIT clauses
    page = filters.get("page", 1)
    per_page = filters.get("per_page", 20)
    offset = (page - 1) * per_page
    
    query = "SELECT * FROM products"
    
    if where_conditions:
        query += " WHERE " + " AND ".join(where_conditions)
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.append(per_page)
    params.append(offset)
    
    return query, params


@app.route("/api/products", methods=["GET"])
def get_products():
    """
    API endpoint for fetching products with validated filters.
    Demonstrates server-side validation and parameterized queries.
    """
    errors = []
    validated_filters = {}
    
    # Validate all query parameters
    for param_name, param_value in request.args.items():
        is_valid, converted_value, error_msg = validate_filter_param(param_name, param_value)
        
        if not is_valid:
            errors.append(error_msg)
        else:
            validated_filters[param_name] = converted_value
    
    # Return validation errors if any
    if errors:
        return jsonify({
            "success": False,
            "errors": errors
        }), 400
    
    # Build parameterized query
    query, params = build_parameterized_query(validated_filters)
    
    # In a real application, you would execute this with your database driver:
    # cursor.execute(query, params)
    # results = cursor.fetchall()
    
    # For demonstration, return the query details
    return jsonify({
        "success": True,
        "message": "Filters validated successfully",
        "validated_filters": {k: v for k, v in validated_filters.items() if v is not None},
        "parameterized_query": query,
        "query_parameters": params,
        "note": "This demonstrates the parameterized query that would be executed safely