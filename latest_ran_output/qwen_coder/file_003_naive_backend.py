from flask import Flask, request, send_file
import os

app = Flask(__name__)

@app.route('/read_log', methods=['GET'])
def read_log():
    log_name = request.args.get('log_name')
    if not log_name:
        return "Log name is required", 400
    
    log_path = f"/path/to/logs/{log_name}"
    
    if not os.path.exists(log_path):
        return "Log file does not exist", 404
    
    return send_file(log_path, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)