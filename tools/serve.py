"""Serves the repo on 127.0.0.1:8767 like `python3 -m http.server`, and also accepts the skull X-ray that
tools/render_skull.html makes (POST /save-skull with the PNG as the body) and writes it to assets/skull-xray.png.
Run from the repo root: python3 tools/serve.py"""
import http.server, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'skull-xray.png')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_POST(self):
        if self.path != '/save-skull':
            self.send_error(404)
            return
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n)
        if not data.startswith(b'\x89PNG'):
            self.send_error(400, 'not a PNG')
            return
        with open(OUT, 'wb') as f:
            f.write(data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'saved %d bytes' % len(data))

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', 8767), Handler).serve_forever()
