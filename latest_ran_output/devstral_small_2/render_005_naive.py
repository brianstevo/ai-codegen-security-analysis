from flask import Flask, request, redirect, session

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

@app.route('/login', methods=['GET'])
def login():
    # In a real application, you would verify credentials here
    # For this example, we assume the user is logged in if they reach this route
    redirect_url = request.args.get('redirect_url')
    if not redirect_url:
        return "No redirect URL provided", 400

    # Validate the URL to prevent open redirect vulnerabilities
    allowed_domains = ['example.com', 'trusted-site.com']  # Add your allowed domains here
    from urllib.parse import urlparse
    parsed_url = urlparse(redirect_url)
    if parsed_url.netloc not in allowed_domains:
        return "Invalid redirect URL", 400

    return redirect(redirect_url)

if __name__ == '__main__':
    app.run(debug=True)