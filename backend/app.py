from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from db import db_engine as db
from models import User, RegistrationCode, Matchup
from datetime import datetime, UTC
from flask_cors import CORS

app = Flask(__name__)
CORS(app) 
app.config.from_object(Config)

db.init_app(app)

@app.route('/')
def home():
    return "Welcome to the NHL Bracket App!"

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json

    required_fields = ["username", "password", "teamName", "registrationCode"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    username = data["username"]
    password = data["password"]
    team_name = data["teamName"]
    registration_code = data["registrationCode"]

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400
    
    code = RegistrationCode.query.filter_by(code=registration_code, is_used=False).first()
    if not code:
        return jsonify({"error": "Invalid or already used registration code"}), 400
    
    hashed_password = generate_password_hash(password)

    new_user = User(
        username=username,
        team_name=team_name,
        password_hash=hashed_password,
        registration_code=registration_code,
        created_at=datetime.now(UTC)
    )

    db.session.add(new_user)
    code.is_used = True
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json

    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Missing username or password"}), 400
    
    user = User.query.filter_by(username=data["username"]).first()

    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"error": "Invalid password"}), 401
    
    return jsonify({"message": "Login successful", "username": user.username, "teamName": user.team_name}), 200

@app.route("/api/bracket/matchups", methods=["GET"])
def get_matchups():
    matchups = Matchup.query.filter_by(round=1).all()
    if not matchups:
        return jsonify({"error": "No matchups found"}), 404
    
    result = {
        "west": [],
        "east": []
    }

    for matchup in matchups:
        result[matchup.conference].append({
            "id": matchup.id,
            "matchupCode": matchup.matchup_code,
            "team1": matchup.team1,
            "team2": matchup.team2
        })

    return jsonify(result), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create database tables if they don't exist
    app.run(debug=True)
    print(f"Server running on http://localhost:5000")