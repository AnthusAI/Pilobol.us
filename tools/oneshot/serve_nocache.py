import http.server
import socketserver
import os

PORT = 8000
DIRECTORY = "web/dist"

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
    httpd.allow_reuse_address = True
    print(f"Serving {DIRECTORY} at port {PORT} with no caching...")
    httpd.serve_forever()
