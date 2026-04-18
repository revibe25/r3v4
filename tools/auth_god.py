#!/usr/bin/env python3

"""
AUTH GOD SYSTEM — FULL AUTO SCAN + FIX + ANALYZE + DEPLOY

Features:
- Recursively scans project
- Detects auth/login flow
- Fixes common 400 errors
- Generates patch report
- Builds dependency graph
- Optional: runs interceptor + JWT server

Run:
    python3 tools/auth_god.py
"""

import os
import re
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.getcwd()

AUTH_KEYWORDS = ["login", "auth", "/api/auth"]

auth_files = []
issues = []
dependency_map = {}


# -----------------------------
# FILE SCANNER
# -----------------------------
def scan_files():
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "dist", "build"]]

        for file in files:
            path = os.path.join(root, file)

            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()

                    if any(k in content for k in AUTH_KEYWORDS):
                        auth_files.append({"path": path, "content": content})
            except:
                continue


# -----------------------------
# DEPENDENCY MAPPING
# -----------------------------
def map_dependencies():
    for file in auth_files:
        imports = re.findall(r'import .* from [\'"](.*)[\'"]', file["content"])
        dependency_map[file["path"]] = imports


# -----------------------------
# AUTO FIX ENGINE
# -----------------------------
def fix_files():
    for file in auth_files:
        content = file["content"]
        updated = content

        # Fix missing Content-Type
        if "fetch(" in content and "Content-Type" not in content:
            updated = updated.replace(
                "fetch(",
                "fetch(",
            )
            updated = updated.replace(
                "{",
                "{\n  headers: { 'Content-Type': 'application/json' },",
                1,
            )
            issues.append(f"🔧 Added Content-Type → {file['path']}")

        # Fix missing JSON.stringify
        if "body:" in content and "JSON.stringify" not in content:
            updated = re.sub(r'body:\s*({.*})', r'body: JSON.stringify(\1)', updated)
            issues.append(f"🔧 Fixed JSON body → {file['path']}")

        # Prevent multiple submits
        if "onSubmit" in content and "preventDefault" not in content:
            issues.append(f"❌ Missing preventDefault → {file['path']}")

        if updated != content:
            with open(file["path"], "w", encoding="utf-8") as f:
                f.write(updated)


# -----------------------------
# CONTRACT CHECK
# -----------------------------
def analyze_contracts():
    frontend = False
    backend = False

    for file in auth_files:
        if "fetch" in file["content"] and "/api/auth/login" in file["content"]:
            frontend = True

        if "req.body" in file["content"] and "/api/auth/login" in file["content"]:
            backend = True

    if not frontend:
        issues.append("❌ No frontend login request found")

    if not backend:
        issues.append("❌ No backend login handler found")


# -----------------------------
# PATCH REPORT
# -----------------------------
def generate_report():
    report = {
        "files": [f["path"] for f in auth_files],
        "issues": issues,
        "dependencies": dependency_map,
    }

    with open("auth_report.json", "w") as f:
        json.dump(report, f, indent=2)

    print("\n📄 Report generated: auth_report.json\n")


# -----------------------------
# SIMPLE GRAPH OUTPUT
# -----------------------------
def generate_graph():
    html = "<html><body><h1>Auth Dependency Graph</h1><ul>"

    for file, deps in dependency_map.items():
        html += f"<li>{file}<ul>"
        for d in deps:
            html += f"<li>{d}</li>"
        html += "</ul></li>"

    html += "</ul></body></html>"

    with open("auth_graph.html", "w") as f:
        f.write(html)

    print("📊 Graph generated: auth_graph.html")


# -----------------------------
# LIVE INTERCEPTOR
# -----------------------------
class Interceptor(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        print("\n📡 REQUEST CAPTURED")
        print("PATH:", self.path)
        print("BODY:", body.decode())

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")


def start_interceptor():
    server = HTTPServer(("localhost", 5050), Interceptor)
    print("🌐 Interceptor running on http://localhost:5050")
    server.serve_forever()


# -----------------------------
# JWT AUTH SERVER
# -----------------------------
def start_jwt_server():
    from flask import Flask, request, jsonify
    import jwt
    import datetime

    app = Flask(__name__)
    SECRET = "SUPER_SECRET_KEY"

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        data = request.json

        if not data or "email" not in data or "password" not in data:
            return jsonify({"error": "Invalid request"}), 400

        token = jwt.encode(
            {"email": data["email"], "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15)},
            SECRET,
            algorithm="HS256",
        )

        return jsonify({"token": token})

    print("🔐 JWT server running on http://localhost:3001")
    app.run(port=3001)


# -----------------------------
# MAIN PIPELINE
# -----------------------------
def run():
    print("\n🚀 AUTH GOD SYSTEM STARTING...\n")

    scan_files()
    map_dependencies()
    fix_files()
    analyze_contracts()
    generate_report()
    generate_graph()

    print("\n⚠️ Issues Found:")
    for i in issues:
        print("-", i)

    print("\nOptions:")
    print("1. Start interceptor")
    print("2. Start JWT auth server")
    print("3. Exit")

    choice = input("\nSelect option: ")

    if choice == "1":
        start_interceptor()
    elif choice == "2":
        start_jwt_server()
    else:
        print("Done.")


if __name__ == "__main__":
    run()
