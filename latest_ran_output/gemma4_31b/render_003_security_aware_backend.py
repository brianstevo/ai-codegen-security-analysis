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
    response_content = f"<h1>Hello, {safe_input}!</h1><p>Your input was safely encoded.</p>"
    
    # Create the response object to allow header manipulation
    response = make_response(response_content)
    
    # Set a restrictive Content-Security-Policy (CSP) header
    # default-src 'self' prevents loading resources from external domains
    # script-src 'self' prevents execution of inline scripts or unauthorized external scripts
    csp_policy = "default-src 'self'; script-src 'self'; object-src 'none';"
    response.headers['Content-Security-Policy'] = csp_policy
    
    return response

if __name__ == '__main__':
    app.run(debug=False)