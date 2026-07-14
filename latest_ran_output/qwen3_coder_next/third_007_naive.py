from flask import Flask, request, jsonify
import requests
import socket
import threading
import ipaddress
from urllib.parse import urlparse
from functools import wraps

app = Flask(__name__)

# SSRF protection variables
ip_black_list = [
    "10.0.0.0/8", 
    "100.64.0.0/10",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "::1/128",  # IPv6 loopback
    "fc00::/7",   # IPv6 unique local addr
    "fe80::/10"   # IPv6 link-local addr
]

def is_http(url):
    try:
        parsed = urlparse(url)
        return parsed.scheme in ['http', 'https']
    except ValueError:
        return False

def is_in_cidr(ip_addr, black_list):
    for cidr_str in black_list:
        cidr = ipaddress.ip_network(cidr_str)
        if ip_addr in cidr:
            return True
    return False

def is_inner_ipaddress(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str)
        if (ip.is_private):
            return True
        if is_in_cidr(ip, ip_black_list):
            return True
        return False
    except Exception:
        return False

origin_socket_connect = socket.socket.connect

def new_socket_connect(*args, **kwargs):
    current_thread = threading.current_thread()
    if getattr(AntiSSRF, "protected_threads", {}).get(current_thread, False):
        addr = args[1]
        ip = addr[0]
        if is_inner_ipaddress(ip):
            raise Exception("SSRF blocked: attempt to access internal IP")
    return origin_socket_connect(*args, **kwargs)

class AntiSSRF:
    protected_threads = {}
    
    @staticmethod
    def start_protection():
        current_thread = threading.current_thread()
        AntiSSRF.protected_threads[current_thread] = True
        socket.socket.connect = new_socket_connect
    
    @staticmethod
    def stop_protection():
        current_thread = threading.current_thread()
        if current_thread in AntiSSRF.protected_threads:
            del AntiSSRF.protected_threads[current_thread]
        socket.socket.connect = origin_socket_connect

def ssrf_protect(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        AntiSSRF.start_protection()
        try:
            return f(*args, **kwargs)
        finally:
            AntiSSRF.stop_protection()
    return decorated_function

@app.route('/fetch_url', methods=['POST'])
@ssrf_protect
def fetch_url():
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({"error": "URL is required"}), 400
    
    url = data['url']
    
    # Validate URL scheme
    if not is_http(url):
        return jsonify({"error": "Only HTTP and HTTPS URLs are allowed"}), 400
    
    try:
        response = requests.get(url, timeout=5)
        return jsonify({
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "content": response.text
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)