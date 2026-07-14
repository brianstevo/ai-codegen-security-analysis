from flask import Flask, request, render_template_string
import html

app = Flask(__name__)

@app.route('/')
def index():
    user_input = request.args.get('input', '')
    safe_input = html.escape(user_input)
    response = render_template_string('<p>Your input: {{ input }}</p>', input=safe_input)
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response

if __name__ == '__main__':
    app.run(debug=True)