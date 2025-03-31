from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, UTC
from flask_cors import CORS
import json

from config import Config
from db import db_engine as db
from models import User, RegistrationCode, Matchup, Pick, Player, LineupPick

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
    
    return jsonify({
        "message": "Login successful",
        "username": user.username,
        "teamName": user.team_name,
        "id": user.id
    }), 200

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

@app.route("/api/bracket/save-picks", methods=["POST"])
def save_picks():
    data = request.json

    user_id = data.get("user_id")
    picks = data.get("picks")

    if not user_id or not picks:
        return jsonify({"error": "Missing user_id or picks"}), 400

    existing_pick = Pick.query.filter_by(user_id=user_id).first()
    if existing_pick:
        db.session.delete(existing_pick)

    try:
        new_pick = Pick(
            user_id=user_id,
            picks_json=json.dumps(picks),
            created_at=datetime.now(UTC)
        )
        db.session.add(new_pick)
        db.session.commit()
        return jsonify({"message": "Picks saved successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to save picks", "details": str(e)}), 500 

@app.route("/api/bracket/get-picks", methods=["GET"])
def get_picks():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    pick = Pick.query.filter_by(user_id=user_id).first()

    if not pick:
        return jsonify({"error": "No picks found for this user"}), 404

    try:
        picks_data = json.loads(pick.picks_json)
        return jsonify({"picks": picks_data}), 200
    except Exception as e:
        print("Error parsing picks JSON:", e)
        return jsonify({"error": "Failed to parse picks", "details": str(e)}), 500

@app.route("/api/players", methods=["GET"])
def get_players():
    players = Player.query.all()
    if not players:
        return jsonify({"error": "No players found"}), 404
    
    result = []
    
    for player in players:
        result.append({
            "id": player.id,
            "firstName": player.first_name,
            "lastName": player.last_name,
            "team": player.team,
            "position": player.position
        })

    return jsonify(result), 200

@app.route("/api/lineup/save", methods=["POST"])
def save_lineup():
    data = request.json

    user_id = data.get("user_id")
    lineup = data.get("lineup")

    if not user_id or not lineup:
        return jsonify({"error": "Missing user_id or lineup"}), 400

    existing = LineupPick.query.filter_by(user_id=user_id).first()
    if existing:
        db.session.delete(existing)

    try:
        new_lineup = LineupPick(
            user_id=user_id,
            lineup_json=json.dumps(lineup),
            created_at=datetime.now(UTC)
        )
        db.session.add(new_lineup)
        db.session.commit()
        return jsonify({"message": "Lineup saved successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to save lineup", "details": str(e)}), 500

@app.route("/api/lineup/get", methods=["GET"])
def get_lineup():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    lineup_pick = LineupPick.query.filter_by(user_id=user_id).first()

    if not lineup_pick:
        return jsonify({"error": "No lineup found for this user"}), 404

    try:
        lineup_data = json.loads(lineup_pick.lineup_json)
        return jsonify({"lineup": lineup_data}), 200
    except Exception as e:
        return jsonify({"error": "Failed to parse lineup", "details": str(e)}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create database tables if they don't exist
    app.run(debug=True)
    print(f"Server running on http://localhost:5000")