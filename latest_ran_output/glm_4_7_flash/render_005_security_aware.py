from flask import Flask, request, redirect
from werkzeug.urls import url_parse

app = Flask(__name__)

# Whitelist of trusted domains (including protocol)
TRUSTED_DOMAINS = [
    "https://myapp.com",
    "https://dashboard.myapp.com"
]

@app.route("/login")
def login():
    # Default redirect if no returnTo is provided
    default_redirect = "/home"

    # Get the returnTo parameter from the query string
    return_to = request.args.get("returnTo", default_redirect)

    # Parse the URL to inspect its components
    parsed = url_parse(return_to)

    # Case 1: Absolute URL (has scheme and netloc)
    if parsed.scheme and parsed.netloc:
        # Check if the domain is in the explicit whitelist
        if parsed.netloc in TRUSTED_DOMAINS:
            return redirect(return_to)
        else:
            # External domain not in whitelist: reject
            return redirect(default_redirect)

    # Case 2: Relative URL (no scheme, no netloc)
    else:
        # Validate that the path does not contain directory traversal attempts
        if ".." in parsed.path:
            return redirect(default_redirect)

        # Allow relative paths
        return redirect(return_to)

if __name__ == "__main__":
    app.run(debug=True)