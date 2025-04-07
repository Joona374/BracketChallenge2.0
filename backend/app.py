from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, UTC
from flask_cors import CORS
import json

from config import Config
from db import db_engine as db
from models import User, RegistrationCode, Matchup, Pick, Player, LineupPick, Prediction

import os
from openai import OpenAI
import requests
from threading import Thread
from dotenv import load_dotenv

load_dotenv()

# With this:
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OpenAI API key not found. Please set it in your environment variables.")
    
client = OpenAI(api_key=api_key)
if not client:
    raise ValueError("OpenAI API key not found. Please set it in your environment variables.")


LOGO_DIR = "team_logos"
os.makedirs(LOGO_DIR, exist_ok=True)

def generate_team_logos(team_name, user_id):
    """
    Generates 4 team logos using OpenAI's DALL·E model and saves them locally.
    """
    prompt = (
        f"Generate an image of logo for imaginary ice hockey team named {team_name}. "
        "The surroundings of the image logo, meaning the background color of the image, should be black. "
        "The logo itself can still have a colorful design and colorful background colors. "
        "The style shouldn't be too serious, but instead lighthearted, ironic, and funny—without being too childish. "
        "These logos are for a fantasy hockey league where all participants are adults who don't mind even offensive themes, "
        "as it's all in a joking spirit. Make sure to center the logo inside the image as much as possible."
    )
    print(f"Generating logos for team: {team_name}")
    try:
        response = client.images.generate(
            prompt=prompt,
            n=1,
            size="1024x1024",  # square aspect ratio
            model="dall-e-3"  # ensure you have access to this model
        )
        # Iterate over the returned image data and save each image
        for i, data in enumerate(response.data):
            image_url = data.url
            if image_url:
                image_response = requests.get(image_url)
                if image_response.status_code == 200:
                    file_path = os.path.join(LOGO_DIR, f"{user_id}_logo_{i}.png")
                    with open(file_path, "wb") as f:
                        f.write(image_response.content)
                else:
                    print(f"Failed to download image {i} for user {user_id}")
    except Exception as e:
        print("Error generating team logos:", e)


app = Flask(__name__)
# Configure CORS with more explicit settings
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:4200"],  # Angular dev server
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
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
    
    existing_teamname = User.query.filter_by(team_name=team_name).first()
    if existing_teamname:
        return jsonify({"error": "Team name already exists"}), 400

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

    # Launch the image generation in a background thread so it doesn't delay the response
    thread = Thread(target=generate_team_logos, args=(team_name, new_user.id))
    thread.start()

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
    try:
        players = Player.query.all()
        return jsonify([{
            'id': p.id,
            'api_id': p.api_id,
            'first_name': p.first_name,
            'last_name': p.last_name,
            'team_abbr': p.team_abbr,
            'position': p.position,
            'jersey_number': p.jersey_number,
            'birth_country': p.birth_country,
            'birth_year': p.birth_year,
            'headshot': p.headshot,
            'is_U23': p.is_U23,
            'price': p.price,
            'reg_gp': p.reg_gp,
            'reg_goals': p.reg_goals,
            'reg_assists': p.reg_assists,
            'reg_points': p.reg_points,
            'reg_plus_minus': p.reg_plus_minus,
            'playoff_goals': p.playoff_goals,
            'playoff_assists': p.playoff_assists,
            'playoff_points': p.playoff_points,
            'playoff_plus_minus': p.playoff_plus_minus
        } for p in players]), 200
    except Exception as e:
        print(f"Error in get_players: {str(e)}")  # Add logging
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

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

@app.route('/api/predictions/save', methods=['POST'])
def save_predictions():
    data = request.json
    user_id = data.get('user_id')
    predictions_data = data.get('predictions')
    
    if not user_id or not predictions_data:
        return jsonify({"error": "Missing required data"}), 400
    
    # Convert predictions data to JSON string
    predictions_json = json.dumps(predictions_data)
    
    # Check if prediction already exists for this user
    existing_prediction = Prediction.query.filter_by(user_id=user_id).first()
    
    if existing_prediction:
        # Update existing prediction
        existing_prediction.predictions_json = predictions_json
        existing_prediction.created_at = datetime.now(UTC)
    else:
        # Create new prediction
        new_prediction = Prediction(
            user_id=user_id,
            predictions_json=predictions_json,
            created_at=datetime.now(UTC)
        )
        db.session.add(new_prediction)
    
    db.session.commit()
    return jsonify({"message": "Predictions saved successfully"}), 200

@app.route('/api/predictions/get', methods=['GET'])
def get_predictions():
    user_id = request.args.get('user_id')
    
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400
    
    prediction = Prediction.query.filter_by(user_id=user_id).first()
    
    if not prediction:
        return jsonify({"message": "No predictions found for this user"}), 404
    
    # Parse the JSON string back into a dictionary
    predictions_data = json.loads(prediction.predictions_json)
    
    return jsonify({"predictions": predictions_data}), 200

@app.route("/api/user/by-team-name", methods=["GET"])
def get_user_by_team_name():
    team_name = request.args.get("teamName")
    
    if not team_name:
        return jsonify({"error": "Missing teamName parameter"}), 400
    
    user = User.query.filter_by(team_name=team_name).first()
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify({
        "userId": user.id,
        "teamName": user.team_name
    }), 200

@app.route("/api/user/stats", methods=["GET"])
def get_user_stats():
    # Get userId parameter but ignore it for now
    user_id = request.args.get('userId')
    
    # Return placeholder data without checking the database
    stats = {
        "rank": 4,
        "points": {
            "total": 65,
            "bracket": 30,
            "lineup": 25,
            "predictions": 10
        }
    }
    
    return jsonify(stats), 200

@app.route("/api/leaderboard", methods=["GET"])
def get_leaderboard():
    # Return actual data from the database, keeping the rank and points using the mock data

    users = User.query.all()
    if not users:
        return jsonify({"error": "No users found"}), 404
    leaderboard = []

    for i, user in enumerate(users):
        # Assuming you have a way to calculate the points for each user
        # For now, we will use mock data for points and ranks
        leaderboard.append({
            "id": user.id,
            "rank": i + 1,  # Rank based on the order in the list
            "username": user.username,
            "teamName": user.team_name,
            "totalPoints": 0,  # Placeholder total points
            "bracketPoints": 0,  # Placeholder bracket points
            "lineupPoints": 0,  # Placeholder lineup points
            "predictionsPoints": 0  # Placeholder predictions points
        })


    return jsonify(leaderboard), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create database tables if they don't exist
    app.run(debug=True)
    print(f"Server running on http://localhost:5000")