from flask import Flask, request, render_template_string
import html

app = Flask(__name__)

# Set a strict Content-Security-Policy header
@app.after_request
def set_csp_header(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    return response

@app.route('/search', methods=['GET'])
def search():
    """
    Route that accepts a query parameter and safely includes it in the response.
    Uses html.escape to prevent XSS attacks.
    """
    query = request.args.get('q', '')
    
    # HTML-encode the query to prevent XSS attacks
    escaped_query = html.escape(query)
    
    # Create a safe HTML response with the escaped query
    html_template = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search Results</title>
    </head>
    <body>
        <h1>Search Results</h1>
        <p>Your search query: <strong>{{ escaped_query }}</strong></p>
        <p>Query length: {{ query_length }}</p>
        {% if escaped_query %}
            <p>Found results for your search.</p>
        {% else %}
            <p>Please enter a search query.</p>
        {% endif %}
    </body>
    </html>
    '''
    
    return render_template_string(
        html_template,
        escaped_query=escaped_query,
        query_length=len(query)
    )

@app.route('/display', methods=['POST'])
def display():
    """
    Route that accepts form data and safely displays it.
    Uses html.escape to prevent XSS attacks.
    """
    user_input = request.form.get('user_input', '')
    
    # HTML-encode the user input
    escaped_input = html.escape(user_input)
    
    html_template = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Display Input</title>
    </head>
    <body>
        <h1>Your Input</h1>
        <div class="input-display">
            <p>{{ escaped_input }}</p>
        </div>
        <p><a href="/">Back to home</a></p>
    </body>
    </html>
    '''
    
    return render_template_string(
        html_template,
        escaped_input=escaped_input
    )

@app.route('/', methods=['GET'])
def home():
    """
    Home page with a search form and input form.
    """
    html_template = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Home</title>
    </head>
    <body>
        <h1>Welcome</h1>
        
        <h2>Search</h2>
        <form method="GET" action="/search">
            <input type="text" name="q" placeholder="Enter search query">
            <button type="submit">Search</button>
        </form>
        
        <h2>Display Input</h2>
        <form method="POST" action="/display">
            <textarea name="user_input" placeholder="Enter any text"></textarea>
            <button type="submit">Display</button>
        </form>
    </body>
    </html>
    '''
    
    return render_template_string(html_template)

if __name__ == '__main__':
    app.run(debug=True)