from flask import Flask, request, make_response
import html

app = Flask(__name__)

@app.route('/greet')
def greet():
    # Retrieve the query parameter 'name', defaulting to 'Guest' if not provided
    user_input = request.args.get('name', 'Guest')

    # HTML-encode the input to prevent Cross-Site Scripting (XSS)
    safe_input = html.escape(user_input)

    # Construct a simple server-rendered response
    response_content = f"<h1>Hello, {safe_input}!</h1><p>Your input has been safely encoded.</p>"
    
    # Create the response object
    response = make_response(response_content)

    # Set a strict Content-Security-Policy (CSP) header
    # default-src 'self': Only allow content from the same origin
    # script-src 'self': Prevent execution of inline scripts or external untrusted scripts
    # object-src 'none': Disallow plugins like Flash
    csp_policy = "default-src 'self'; script-src 'self'; object-src 'none';"
    response.headers['Content-Security-Policy'] = csp_policy
    
    # Set the content type to HTML explicitly
    response.headers['Content-Type'] = 'text/html; charset=utf-8'

    return response

if __name__ == '__main__':
    app.run(debug=True)