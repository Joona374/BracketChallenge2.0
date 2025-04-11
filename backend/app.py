from flask import Flask, request, jsonify
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, UTC
from flask_cors import CORS
import json
import random

from config import Config
from db import db_engine as db
from models import User, RegistrationCode, Matchup, Pick, Player, Goalie, LineupPick, Prediction, Vote, MatchupResult, Team, UserPoints, LineupHistory, ResetCode

import os
from openai import OpenAI
import requests
from threading import Thread
from dotenv import load_dotenv

load_dotenv()

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
migrate = Migrate(app, db)
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
    # thread = Thread(target=generate_team_logos, args=(team_name, new_user.id))
    # thread.start()

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
        "id": user.id,
        "logoUrl": user.selected_logo_url,
        "isAdmin": user.is_admin,
        "hasVoted": user.has_voted
    }), 200

@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.json

    if not data or not all(k in data for k in ["username", "resetCode", "newPassword"]):
        return jsonify({"error": "Missing required fields"}), 400

    user = User.query.filter_by(username=data["username"]).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    reset_code = ResetCode.query.filter_by(
        code=data["resetCode"],
        user_id=user.id,
        is_used=False
    ).first()

    if not reset_code:
        return jsonify({"error": "Invalid or expired reset code"}), 400

    try:
        # Update password
        user.password_hash = generate_password_hash(data["newPassword"])
        # Mark reset code as used
        reset_code.is_used = True
        db.session.commit()
        return jsonify({"message": "Password reset successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route("/api/user-logos", methods=["GET"])
def get_user_logos():
    user_id = request.args.get("userId")

    if not user_id:
        return jsonify({"error": "Missing userId parameter"}), 400

    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    logos = {
        "logo1": user.logo1_url,
        "logo2": user.logo2_url,
        "logo3": user.logo3_url,
        "logo4": user.logo4_url
    }

    return jsonify(logos), 200

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

@app.route("/api/goalies", methods=["GET"])
def get_goalies():
    try:
        goalies = Goalie.query.all()
        return jsonify([{
            'id': g.id,
            'api_id': g.api_id,
            'first_name': g.first_name,
            'last_name': g.last_name,
            'team_abbr': g.team_abbr,
            'position': g.position,
            'jersey_number': g.jersey_number,
            'birth_country': g.birth_country,
            'birth_year': g.birth_year,
            'headshot': g.headshot,
            'is_U23': g.is_U23,
            'price': g.price,
            'reg_gp': g.reg_gp,
            'reg_gaa': g.reg_gaa,
            'reg_save_pct': g.reg_save_pct,
            'reg_shutouts': g.reg_shutouts,
            'reg_wins': g.reg_wins,
            'playoff_gp': g.playoff_gp,
            'playoff_gaa': g.playoff_gaa,
            'playoff_save_pct': g.playoff_save_pct,
            'playoff_shutouts': g.playoff_shutouts,
            'playoff_wins': g.playoff_wins
        } for g in goalies]), 200
    except Exception as e:
        print(f"Error in get_goalies: {str(e)}")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

@app.route("/api/lineup/save", methods=["POST"])
def save_lineup():
    data = request.json

    user_id = data.get("user_id")
    lineup = data.get("lineup")
    trades_used = data.get("tradesUsed", 0)

    if not user_id or not lineup:
        return jsonify({"error": "Missing user_id or lineup"}), 400

    try:
        with db.session.begin():
            # Get existing lineup if any
            existing = LineupPick.query.filter_by(user_id=user_id).first()
            old_lineup = json.loads(existing.lineup_json) if existing else {}
            
            # Calculate current value of lineup
            total_value = 0
            current_time = datetime.now(UTC)
            
            # Process each slot in the new lineup
            for slot, player_id in lineup.items():
                if player_id:
                    # Determine if it's a goalie slot
                    if slot == 'G':
                        goalie = Goalie.query.get(player_id)
                        if goalie:
                            print(f"Processing goalie: {goalie.first_name} {goalie.last_name}, Slot: {slot}, ID: {player_id}, Price: {goalie.price}")
                            total_value += goalie.price

                            # If this is a new goalie in this slot
                            if not old_lineup.get(slot) == player_id:
                                # Close out old goalie's history
                                if old_lineup.get(slot):
                                    db.session.query(LineupHistory)\
                                        .filter_by(user_id=user_id, slot=slot, removed_at=None)\
                                        .update({"removed_at": current_time})
                                
                                # Add new goalie history
                                history = LineupHistory(
                                    user_id=user_id,
                                    player_id=player_id,
                                    slot=slot,
                                    added_at=current_time,
                                    price_at_time=goalie.price
                                )
                                db.session.add(history)
                    else:
                        player = Player.query.get(player_id)
                        if player:
                            print(f"Processing player: {player.first_name} {player.last_name}, Slot: {slot}, ID: {player_id}, Price: {player.price}")
                            total_value += player.price
                            
                            # If this is a new player in this slot
                            if not old_lineup.get(slot) == player_id:
                                # Close out old player's history
                                if old_lineup.get(slot):
                                    db.session.query(LineupHistory)\
                                        .filter_by(user_id=user_id, slot=slot, removed_at=None)\
                                        .update({"removed_at": current_time})
                                
                                # Add new player history
                                history = LineupHistory(
                                    user_id=user_id,
                                    player_id=player_id,
                                    slot=slot,
                                    added_at=current_time,
                                    price_at_time=player.price
                                )
                                db.session.add(history)

            if existing:
                # Update existing lineup
                existing.lineup_json = json.dumps(lineup)
                existing.remaining_trades -= trades_used
                existing.unused_budget = data.get("unusedBudget", 0)
                existing.total_value = total_value
                existing.updated_at = current_time
            else:
                # Create new lineup
                new_lineup = LineupPick(
                    user_id=user_id,
                    lineup_json=json.dumps(lineup),
                    remaining_trades=9 - trades_used,
                    unused_budget=data.get("unusedBudget", 0),
                    total_value=total_value,
                    created_at=current_time
                )
                db.session.add(new_lineup)

        return jsonify({
            "message": "Lineup saved successfully",
            "totalValue": total_value
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route("/api/lineup/get", methods=["GET"])
def get_lineup():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    try:
        lineup_pick = LineupPick.query.filter_by(user_id=user_id).first()

        if not lineup_pick:
            return jsonify({"error": "No lineup found for this user"}), 404

        lineup_data = json.loads(lineup_pick.lineup_json)
        
        # Calculate current total value
        total_value = 0
        for slot, player_id in lineup_data.items():
            if player_id:
                if slot == 'G':
                    goalie = Goalie.query.get(player_id)
                    if goalie:
                        total_value += goalie.price
                else:
                    player = Player.query.get(player_id)
                    if player:
                        total_value += player.price

        return jsonify({
            "lineup": lineup_data,
            "remainingTrades": lineup_pick.remaining_trades,
            "unusedBudget": lineup_pick.unused_budget,
            "totalValue": total_value,
            "effectiveBudget": total_value + lineup_pick.unused_budget
        }), 200

    except Exception as e:
        print("Error getting lineup:", e)  # Add logging
        # Handle JSON parsing errors
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
        "teamName": user.team_name,
        "logoUrl": user.selected_logo_url,
    }), 200

@app.route("/api/user/logo", methods=["POST"])
def update_user_logo():
    data = request.json
    user_id = data.get("userId")
    logo_url = data.get("logoUrl")
    
    if not user_id or not logo_url:
        return jsonify({"error": "Missing userId or logoUrl"}), 400
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Update the selected logo URL
    user.selected_logo_url = logo_url
    
    try:
        db.session.commit()
        return jsonify({
            "message": "User logo updated successfully",
            "logoUrl": logo_url
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update logo: {str(e)}"}), 500

@app.route("/api/user/assign-logos", methods=["POST"])
def assign_custom_logos():
    data = request.json
    user_id = data.get("userId")
    logo_urls = data.get("logoUrls")
    
    if not user_id or not logo_urls:
        return jsonify({"error": "Missing userId or logoUrls"}), 400
    
    if len(logo_urls) != 4:
        return jsonify({"error": "Exactly 4 logo URLs must be provided"}), 400
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    try:
        user.logo1_url = logo_urls[0]
        user.logo2_url = logo_urls[1]
        user.logo3_url = logo_urls[2]
        user.logo4_url = logo_urls[3]
        
        db.session.commit()
        
        return jsonify({
            "message": "Logo URLs assigned successfully",
            "userId": user_id,
            "logoUrls": {
                "logo1": user.logo1_url,
                "logo2": user.logo2_url,
                "logo3": user.logo3_url,
                "logo4": user.logo4_url
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to assign logo URLs: {str(e)}"}), 500

@app.route("/api/user/stats", methods=["GET"])
def get_user_stats():
    user_id = request.args.get('userId')
    
    if not user_id:
        return jsonify({"error": "Missing userId parameter"}), 400
    
    try:
        # Fetch the user's points record
        user_points = UserPoints.query.filter_by(user_id=int(user_id)).first()
        
        if not user_points:
            # Return default values if no points record exists
            return jsonify({
                "rank": None,
                "points": {
                    "total": 0,
                    "bracket": 0,
                    "lineup": 0,
                    "predictions": 0
                }
            }), 200
        
        # Get all user points
        all_points = UserPoints.query.all()
        
        # Get all unique point values in descending order
        unique_points = sorted(set(p.total_points for p in all_points), reverse=True)
        
        # Create a mapping from points to rank
        points_to_rank = {points: rank+1 for rank, points in enumerate(unique_points)}
        
        # Get user's rank
        user_rank = points_to_rank.get(user_points.total_points)
        
        return jsonify({
            "rank": user_rank,
            "points": {
                "total": user_points.total_points,
                "bracket": user_points.bracket_total_points,
                "lineup": user_points.lineup_total_points,
                "predictions": user_points.predictions_total_points
            }
        }), 200
    
    except Exception as e:
        print(f"Error getting user stats: {str(e)}")
        return jsonify({"error": f"Failed to retrieve user stats: {str(e)}"}), 500

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
        bracket_points = random.randint(0, 100)  # Placeholder for actual points calculation
        lineup_points = random.randint(0, 100)  # Placeholder for actual points calculation
        predictions_points = random.randint(0, 100)  # Placeholder for actual points calculation
        total_points = bracket_points + lineup_points + predictions_points
        leaderboard.append({
            "id": user.id,
            "rank": i + 1,  # Rank based on the order in the list
            "username": user.username,
            "teamName": user.team_name,
            "logoUrl": user.selected_logo_url,
            "totalPoints": total_points,  # Placeholder total points
            "bracketPoints": bracket_points,  # Placeholder bracket points
            "lineupPoints": lineup_points,  # Placeholder lineup points
            "predictionsPoints": 0  # Placeholder predictions points
        })

    return jsonify(leaderboard), 200

@app.route('/api/votes', methods=['POST'])
def submit_vote():
    data = request.json
    user_id = data.get('userId')
    
    if not user_id:
        print("User ID is missing.")
        return jsonify({'error': 'Missing user_id'}), 400
    
    user = User.query.get(user_id)
    if not user:
        print(f"User with ID {user_id} not found.")
        return jsonify({'error': 'User not found'}), 404
    
    if user.has_voted:
        print(f"User {user_id} has already voted.")
        return jsonify({'error': 'User has already voted'}), 400
        
    if not all(key in data for key in ['entryFee', 'distribution']):
        print("Missing required data in the request.")
        return jsonify({'error': 'Missing required data'}), 400
        
    distribution = data['distribution']
    if sum([distribution['first'], distribution['second'], distribution['third']]) != 100:
        print("Distribution does not total 100%.")
        return jsonify({'error': 'Distribution must total 100%'}), 400

    vote = Vote(
        user_id=user_id,
        entry_fee=data['entryFee'],
        first_place_percentage=distribution['first'],
        second_place_percentage=distribution['second'],
        third_place_percentage=distribution['third']
    )
    
    user.has_voted = True
    
    db.session.add(vote)
    db.session.commit()
    
    return jsonify({'message': 'Vote submitted successfully'}), 201

@app.route('/api/votes/stats', methods=['GET'])
def get_vote_stats():
    # Get entry fee votes
    entry_fee_votes = db.session.query(
        Vote.entry_fee,
        db.func.count(Vote.id).label('count')
    ).group_by(Vote.entry_fee).all()
    
    # Get average distribution
    avg_distribution = db.session.query(
        db.func.avg(Vote.first_place_percentage).label('first'),
        db.func.avg(Vote.second_place_percentage).label('second'),
        db.func.avg(Vote.third_place_percentage).label('third')
    ).first()
    
    return jsonify({
        'entryFeeVotes': {fee: count for fee, count in entry_fee_votes},
        'averageDistribution': {
            'first': round(avg_distribution.first or 0),
            'second': round(avg_distribution.second or 0),
            'third': round(avg_distribution.third or 0)
        }
    }), 200

@app.route('/api/votes/user/<int:user_id>', methods=['GET'])
def get_user_vote(user_id):
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400
    
    vote = Vote.query.filter_by(user_id=user_id).first()
    
    if not vote:
        return jsonify({'message': 'User has not voted yet'}), 404
    
    return jsonify({
        'vote': {
            'entry_fee': vote.entry_fee,
            'first_place_percentage': vote.first_place_percentage,
            'second_place_percentage': vote.second_place_percentage,
            'third_place_percentage': vote.third_place_percentage,
            'created_at': vote.created_at.isoformat()
        }
    }), 200

@app.route('/api/bracket/save-matchups', methods=['POST'])
def save_matchups():
    data = request.get_json()
    
    if not data or 'east' not in data or 'west' not in data:
        return jsonify({"error": "Invalid data format"}), 400
        
    try:
        # Clear existing round 1 matchups
        Matchup.query.filter_by(round=1).delete()
        db.session.commit()
        
        # Save East matchups
        for matchup_data in data['east']:
            new_matchup = Matchup(
                team1=matchup_data['team1'],
                team2=matchup_data['team2'],
                round=1,
                conference='east',
                matchup_code=f"E{data['east'].index(matchup_data)+1}"
            )
            db.session.add(new_matchup)
            
        # Save West matchups
        for matchup_data in data['west']:
            new_matchup = Matchup(
                team1=matchup_data['team1'],
                team2=matchup_data['team2'],
                round=1,
                conference='west',
                matchup_code=f"W{data['west'].index(matchup_data)+1}"
            )
            db.session.add(new_matchup)
            
        db.session.commit()
        return jsonify({"message": "Matchups saved successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        print("Error saving matchups:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/bracket/round-matchups', methods=['GET'])
def get_round_matchups():
    round_num = request.args.get('round', 1, type=int)
    
    if round_num not in [1, 2, 3, 4]:
        return jsonify({"error": "Invalid round number"}), 400
        
    try:
        result = {
            "east": [],
            "west": [],
            "final": None
        }
        
        if round_num < 4:
            # Get conference matchups
            east_matchups = Matchup.query.filter_by(round=round_num, conference='east').all()
            west_matchups = Matchup.query.filter_by(round=round_num, conference='west').all()
            
            result["east"] = [{
                "id": m.id,
                "team1": m.team1,
                "team2": m.team2,
                "round": m.round,
                "conference": m.conference,
                "matchup_code": m.matchup_code
            } for m in east_matchups]
            
            result["west"] = [{
                "id": m.id,
                "team1": m.team1,
                "team2": m.team2,
                "round": m.round,
                "conference": m.conference,
                "matchup_code": m.matchup_code
            } for m in west_matchups]
        else:
            # Get Stanley Cup final matchup
            final = Matchup.query.filter_by(round=4).first()
            if final:
                result["final"] = {
                    "id": final.id,
                    "team1": final.team1,
                    "team2": final.team2,
                    "round": final.round,
                    "conference": final.conference,
                    "matchup_code": final.matchup_code
                }
        
        return jsonify(result), 200
        
    except Exception as e:
        print("Error getting round matchups:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/bracket/save-results', methods=['POST'])
def save_round_results():
    data = request.get_json()
    
    if not data or 'round' not in data or 'results' not in data:
        return jsonify({"error": "Invalid data format"}), 400
    
    round_num = int(data['round'])
    results = data['results']
    formatted_results = data.get('formattedResults', {})
    
    try:
        # Save the current round results
        for result in results:
            matchup_id = result.get('matchupId')
            matchup_code = result.get('matchupCode')
            winner = result.get('winner')
            games = result.get('games')
            
            # Add debug output
            print(f"Processing result: id={matchup_id}, code={matchup_code}, winner={winner}, games={games}")
            
            if not matchup_id or not winner:
                print("Invalid result data:", result)
                return jsonify({"error": "Invalid result data"}), 400
                
            # Ensure matchup_id is an integer
            if isinstance(matchup_id, str):
                try:
                    matchup_id = int(matchup_id)
                except ValueError:
                    return jsonify({"error": f"Invalid matchup ID: {matchup_id}"}), 400
            
            # Check if result already exists and update it or create new
            existing_result = MatchupResult.query.filter_by(matchup_code=matchup_code).first()
            if existing_result:
                existing_result.winner = winner
                existing_result.games = games
                existing_result.matchup_id = matchup_id
            else:
                matchup_result = MatchupResult(
                    matchup_code=matchup_code,
                    matchup_id=matchup_id,
                    winner=winner,
                    games=games
                )
                db.session.add(matchup_result)

        # Create matchups for the next round
        next_round = round_num + 1
        
        # Only create next round matchups for rounds 1-3
        if next_round <= 4:
            # Delete any existing matchups for the next round
            Matchup.query.filter_by(round=next_round).delete()
            
            # Extract winners by matchup code
            winners = {}
            for result in results:
                # Make sure matchupCode is treated as string
                matchup_code = str(result.get('matchupCode'))
                winners[matchup_code] = result.get('winner')
            
            print("Winner mapping:", winners)
            
            # Create matchups for different rounds
            if round_num == 1:
                # Create round 2 matchups (Conference Semifinals)
                # East Conference Semifinals
                if all(code in winners for code in ['E1', 'E2']):
                    e_semi_1 = Matchup(
                        team1=winners['E1'],
                        team2=winners['E2'],
                        round=2,
                        conference='east',
                        matchup_code='e-semi'
                    )
                    db.session.add(e_semi_1)
                
                if all(code in winners for code in ['E3', 'E4']):
                    e_semi_2 = Matchup(
                        team1=winners['E3'],
                        team2=winners['E4'],
                        round=2,
                        conference='east',
                        matchup_code='e-semi2'
                    )
                    db.session.add(e_semi_2)
                
                # West Conference Semifinals
                if all(code in winners for code in ['W1', 'W2']):
                    w_semi_1 = Matchup(
                        team1=winners['W1'],
                        team2=winners['W2'],
                        round=2,
                        conference='west',
                        matchup_code='w-semi'
                    )
                    db.session.add(w_semi_1)
                
                if all(code in winners for code in ['W3', 'W4']):
                    w_semi_2 = Matchup(
                        team1=winners['W3'],
                        team2=winners['W4'],
                        round=2,
                        conference='west',
                        matchup_code='w-semi2'
                    )
                    db.session.add(w_semi_2)
                
            elif round_num == 2:
                # Create round 3 matchups (Conference Finals)
                if all(code in winners for code in ['e-semi', 'e-semi2']):
                    east_final = Matchup(
                        team1=winners['e-semi'],
                        team2=winners['e-semi2'],
                        round=3,
                        conference='east',
                        matchup_code='east-final'
                    )
                    db.session.add(east_final)
                
                if all(code in winners for code in ['w-semi', 'w-semi2']):
                    west_final = Matchup(
                        team1=winners['w-semi'],
                        team2=winners['w-semi2'],
                        round=3,
                        conference='west',
                        matchup_code='west-final'
                    )
                    db.session.add(west_final)
                
            elif round_num == 3:
                # Create round 4 matchup (Stanley Cup Final)
                if all(code in winners for code in ['east-final', 'west-final']):
                    cup_final = Matchup(
                        team1=winners['east-final'],
                        team2=winners['west-final'],
                        round=4,
                        conference='final',
                        matchup_code='cup'
                    )
                    db.session.add(cup_final)

        db.session.commit()
        return jsonify({
            "message": "Results saved successfully and next round matchups created",
            "nextRound": next_round if next_round <= 4 else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print("Error saving results:", str(e))
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/api/teams", methods=["GET"])
def get_teams():
    """
    Endpoint to fetch all NHL teams from the database
    """
    try:
        teams = Team.query.all()
        teams_data = [
            {
                'id': team.id,
                'name': team.name,
                'code': team.abbr,
                'logo_url': team.logo_url
            }
            for team in teams
        ]
        
        return jsonify(teams_data), 200
    except Exception as e:
        print(f"Error fetching teams: {e}")
        return jsonify({"error": "Failed to fetch teams"}), 500

if __name__ == '__main__':
    app.run(debug=True)
    with app.app_context():
        db.create_all()

    print(f"Server running on http://localhost:5000")