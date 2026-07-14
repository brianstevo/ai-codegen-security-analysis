from flask import Flask, request, render_template_string
import html

app = Flask(__name__)

@app.route('/')
def index():
    user_input = request.args.get('input', '')
    safe_input = html.escape(user_input)
    csp_header = "default-src 'self'; script-src 'self' https://trusted.cdn.com"
    
    response = render_template_string('<html><head><meta http-equiv="Content-Security-Policy" content="{{csp}}"></head><body>{{input}}</body></html>', input=safe_input, csp=csp_header)
    response.headers['Content-Security-Policy'] = csp_header
    
    return response

if __name__ == '__main__':
    app.run(debug=True)