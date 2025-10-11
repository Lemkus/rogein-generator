from flask import Flask, send_from_directory, jsonify, request
import os
import requests
import json

application = Flask(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

@application.route("/")
def index():
    return send_from_directory(".", "index.html")

@application.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

@application.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "TrailSpot API works"})

@application.route("/api/overpass/paths", methods=["POST"])
def overpass_paths():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[highway=path][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@application.route("/api/overpass/barriers", methods=["POST"])
def overpass_barriers():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[barrier][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@application.route("/api/overpass/closed-areas", methods=["POST"])
def overpass_closed_areas():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[access=private][bbox:{bbox}];way[access=no][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@application.route("/api/overpass/water-areas", methods=["POST"])
def overpass_water_areas():
    try:
        data = request.get_json()
        bbox = data.get("bbox", "")
        query = f"[out:json][timeout:25];(way[natural=water][bbox:{bbox}];way[waterway][bbox:{bbox}];);out geom;"
        response = requests.post(OVERPASS_URL, data=query, timeout=30)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    application.run(host="0.0.0.0")
