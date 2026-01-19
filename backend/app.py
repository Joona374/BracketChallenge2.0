from flask import Flask, request, jsonify
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone, timedelta
from flask_cors import CORS, cross_origin
import json
import random

from config import Config
from db import db_engine as db
from models import User, RegistrationCode, Matchup, Pick, Player, Goalie, LineupPick, Prediction, Vote, MatchupResult, Team, UserPoints, ResetCode, Headline, Setting
from score_module import calculate_bracket_points
from stats_module import get_current_standings

import os
import requests
from dotenv import load_dotenv

# Default deadline (will be used only if not in database)
DEFAULT_DEADLINE = datetime(2025, 4, 20, 0, 0, 0, tzinfo=timezone.utc)

# --- Grace period logic ---
GRACE_PERIOD_END = datetime(2025, 4, 24, 4, 0, 0, tzinfo=timezone.utc)  # 24.4.2025 07:00 UTC+3 == 04:00 UTC


def is_grace_period_active():
    """Return True if now is after the deadline but before the grace period end."""
    now = datetime.now(timezone.utc)
    deadline = get_deadline_from_db()
    return deadline <= now < GRACE_PERIOD_END

def get_deadline_from_db():
    """Get the playoff deadline from the database settings table"""
    setting = Setting.query.filter_by(key='playoff_deadline').first()
    
    if setting:
        try:
            return datetime.fromisoformat(setting.value)
        except ValueError:
            print(f"Invalid deadline format in database: {setting.value}")
    
    # Default to April 20, 2025 00:00:00 UTC if not found or invalid
    default_deadline = datetime(2025, 4, 20, 0, 0, 0, tzinfo=timezone.utc)
    
    # Create the setting if it doesn't exist
    if not setting:
        setting = Setting(
            key='playoff_deadline',
            value=default_deadline.isoformat(),
            description='Deadline for playoff bracket, lineup, and predictions submissions'
        )
        db.session.add(setting)
        db.session.commit()
    
    return default_deadline

def is_deadline_passed():
    """Check if the playoff submission deadline has passed"""
    now = datetime.now(timezone.utc)
    deadline = get_deadline_from_db()
    return now >= deadline

def get_time_until_deadline():
    """Get a human-readable string of time remaining until the deadline"""
    now = datetime.now(timezone.utc)
    deadline = get_deadline_from_db()
    
    if now >= deadline:
        return "Deadline has passed"
    
    time_diff = deadline - now
    days = time_diff.days
    hours, remainder = divmod(time_diff.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    
    if days > 0:
        return f"{days} days, {hours} hours, {minutes} minutes"
    elif hours > 0:
        return f"{hours} hours, {minutes} minutes"
    else:
        return f"{minutes} minutes, {seconds} seconds"

load_dotenv()


app = Flask(__name__)
migrate = Migrate(app, db)

# Configure CORS - allow all origins for portfolio demo
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

app.config.from_object(Config)

db.init_app(app)

@app.route('/api')
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
        created_at=datetime.now(timezone.utc)
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

    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"error": "Invalid userId"}), 400

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
        
    # Check if the deadline has passed
    if is_deadline_passed():
        return jsonify({"error": "Bracket submission deadline has passed. No changes allowed."}), 403

    existing_pick = Pick.query.filter_by(user_id=user_id).first()
    if existing_pick:
        db.session.delete(existing_pick)

    try:
        new_pick = Pick(
            user_id=user_id,
            picks_json=json.dumps(picks),
            created_at=datetime.now(timezone.utc)
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

    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"error": "Invalid user_id"}), 400

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
    if not user_id or not lineup:
        return jsonify({"error": "Missing user_id or lineup"}), 400
    if is_grace_period_active():
        return jsonify({"error": "Lineup changes are disabled during the grace period (until 24.4.2025 07:00 UTC+3)."}), 403
    try:
        existing = LineupPick.query.filter_by(user_id=user_id).first()
        deadline_passed = is_deadline_passed()
        if not existing and deadline_passed:
            return jsonify({"error": "Lineup submission deadline has passed. New lineups cannot be created."}), 403
        total_value = 0
        for slot, player_id in lineup.items():
            if player_id:
                if slot == 'G':
                    goalie = Goalie.query.get(player_id)
                    if goalie:
                        total_value += goalie.price
                else:
                    player = Player.query.get(player_id)
                    if player:
                        total_value += player.price
        if existing:
            existing.lineup_json = json.dumps(lineup)
            existing.unused_budget = data.get("unusedBudget", 0)
            existing.total_value = total_value
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_lineup = LineupPick(
                user_id=user_id,
                lineup_json=json.dumps(lineup),
                unused_budget=data.get("unusedBudget", 0),
                total_value=total_value,
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(new_lineup)
        db.session.commit()
        return jsonify({"message": "Lineup saved successfully", "totalValue": total_value}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route("/api/lineup/get", methods=["GET"])
def get_lineup():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400
    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"error": "Invalid user_id"}), 400
    try:
        lineup_pick = LineupPick.query.filter_by(user_id=user_id).first()
        if not lineup_pick:
            return jsonify({"error": "No lineup found for this user"}), 404
        lineup_data = json.loads(lineup_pick.lineup_json)
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
            "unusedBudget": lineup_pick.unused_budget,
            "totalValue": total_value,
            "effectiveBudget": total_value + lineup_pick.unused_budget
        }), 200
    except Exception as e:
        print("Error getting lineup:", e)
        return jsonify({"error": "Failed to parse lineup", "details": str(e)}), 500

@app.route('/api/predictions/save', methods=['POST'])
def save_predictions():
    data = request.json
    user_id = data.get('user_id')
    predictions_data = data.get('predictions')
    
    if not user_id or not predictions_data:
        return jsonify({"error": "Missing required data"}), 400
    
    # Check if the deadline has passed
    if is_deadline_passed():
        return jsonify({"error": "Prediction submission deadline has passed. No changes allowed."}), 403
    
    # Convert predictions data to JSON string
    predictions_json = json.dumps(predictions_data)
    
    # Check if prediction already exists for this user
    existing_prediction = Prediction.query.filter_by(user_id=user_id).first()
    
    if existing_prediction:
        # Update existing prediction
        existing_prediction.predictions_json = predictions_json
        existing_prediction.created_at = datetime.now(timezone.utc)
    else:
        # Create new prediction
        new_prediction = Prediction(
            user_id=user_id,
            predictions_json=predictions_json,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(new_prediction)
    
    db.session.commit()
    return jsonify({"message": "Predictions saved successfully"}), 200

@app.route('/api/predictions/get', methods=['GET'])
def get_predictions():
    user_id = request.args.get('user_id')

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    # Convert to int - PostgreSQL requires exact type matching
    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"error": "Invalid user ID"}), 400

    prediction = Prediction.query.filter_by(user_id=user_id).first()

    if not prediction:
        return jsonify({"message": "No predictions found for this user"}), 404

    # Parse the JSON string back into a dictionary
    predictions_data = json.loads(prediction.predictions_json)

    return jsonify({"predictions": predictions_data}), 200

@app.route('/api/predictions/summary', methods=['GET'])
def get_predictions_summary():
    """Get a summary of the user's predictions compared to current standings"""
    from stats_module import get_current_standings

    user_id = request.args.get('userId')
    print(f"\nProcessing predictions summary for user {user_id}")

    if not user_id:
        return jsonify({"error": "Missing userId parameter"}), 400

    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"error": "Invalid userId"}), 400

    try:
        # Get the user's predictions
        prediction = Prediction.query.filter_by(user_id=user_id).first()
        if not prediction:
            return jsonify({"error": "No predictions found for this user"}), 404

        predictions_data = json.loads(prediction.predictions_json)

        # Get current standings from stats module
        print("\nFetching current standings...")
        current_standings = get_current_standings()
        print(f"\nGot current standings for categories: {list(current_standings.keys())}")

        # Initialize summary structure
        summary = {
            "completed": 0,
            "totalToComplete": len(current_standings) * 3,  # 3 picks per category
            "categories": [],
            "totalCorrect": 0
        }

        # Process each category from the current standings
        for category, curr_top3 in current_standings.items():
            print(f"\nProcessing category: {category}")
            if category in predictions_data:
                # Get user's picks for this category
                user_picks = predictions_data[category]
                if isinstance(user_picks, list):
                    user_picks = user_picks[:3]  # Get top 3 picks

                # Count correct picks by comparing IDs
                correct_picks = 0
                for pick in user_picks:
                    if isinstance(pick, str):
                        # Legacy format: compare by name
                        pick_name = pick
                        correct_picks += sum(1 for p in curr_top3 if f"{p.first_name} {p.last_name}" == pick_name)
                    else:
                        # New format: compare by ID
                        pick_id = pick.get('id')
                        correct_picks += sum(1 for p in curr_top3 if p.id == pick_id)

                # Convert current top 3 players/goalies to dictionaries
                current_top3_dicts = []
                for player in curr_top3:
                    if hasattr(player, 'reg_gaa'):  # It's a goalie
                        player_dict = {
                            'id': player.id,
                            'firstName': player.first_name,
                            'lastName': player.last_name,
                            'team': player.team_abbr,
                            'position': player.position,
                            'isU23': player.is_U23,
                            'price': player.price,
                            'reg_gp': player.reg_gp,
                            'reg_gaa': player.reg_gaa,
                            'reg_save_pct': player.reg_save_pct,
                            'reg_shutouts': player.reg_shutouts,
                            'reg_wins': player.reg_wins
                        }
                    else:  # It's a player
                        player_dict = {
                            'id': player.id,
                            'firstName': player.first_name,
                            'lastName': player.last_name,
                            'team': player.team_abbr,
                            'position': player.position,
                            'isU23': player.is_U23,
                            'price': player.price,
                            'reg_gp': player.reg_gp,
                            'reg_goals': player.reg_goals,
                            'reg_assists': player.reg_assists,
                            'reg_points': player.reg_points,
                            'reg_plus_minus': player.reg_plus_minus,
                            'playoff_goals': 0,
                            'playoff_assists': 0,
                            'playoff_points': 0,
                            'playoff_plus_minus': 0
                        }
                        if hasattr(player, 'reg_penalty_minutes'):
                            player_dict['reg_penalty_minutes'] = player.reg_penalty_minutes

                    current_top3_dicts.append(player_dict)

                category_summary = {
                    "name": category,
                    "userPicks": user_picks,
                    "currentTop3": current_top3_dicts,
                    "correctPicks": correct_picks
                }

                summary["categories"].append(category_summary)
                summary["totalCorrect"] += correct_picks

                # Update completed count if we have actual standings
                if curr_top3:
                    summary["completed"] += 1

        return jsonify(summary), 200

    except Exception as e:
        print(f"Error getting predictions summary: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"Failed to get predictions summary: {str(e)}"}), 500

@app.route("/api/bracket/summary", methods=["GET"])
def get_bracket_summary():
    """
    Returns a summary of the user's bracket picks vs. actual results for dashboard display.
    """
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify({"error": "Missing userId parameter"}), 400
    try:
        user_id = int(user_id)
    except ValueError:
        return jsonify({"error": "Invalid userId"}), 400
    try:
        # Get the user's picks
        pick = Pick.query.filter_by(user_id=user_id).first()
        if not pick:
            return jsonify({"error": "No picks found for this user"}), 404
        picks_data = json.loads(pick.picks_json)

        # Get all actual results
        all_results = MatchupResult.query.all()
        results_by_code = {result.matchup_code: result for result in all_results}

        # Helper for round structure
        def build_matchup_comparison(matchup_code, user_pick, user_games, round_name):
            actual = results_by_code.get(matchup_code)
            actual_winner = actual.winner if actual else "Kesken"
            actual_games = actual.games if actual else 0
            user_correct = actual and actual.winner == user_pick
            games_correct = actual and actual.games == user_games and user_correct
            return {
                "userPickedTeam": user_pick or "-",
                "actualWinner": actual_winner or "Kesken",
                "userPickedGames": user_games or 0,
                "actualGames": actual_games or 0,
                "userCorrect": bool(user_correct),
                "gamesCorrect": bool(games_correct)
            }

        # Build roundMatchups for dashboard
        round_matchups = []
        # Round 1
        r1 = []
        for code in ["W1", "W2", "W3", "W4", "E1", "E2", "E3", "E4"]:
            user_pick = picks_data.get("round1", {}).get(code)
            user_games = picks_data.get("round1Games", {}).get(code)
            if user_pick:
                r1.append(build_matchup_comparison(code, user_pick, user_games, "Ensimmäinen kierros"))
        round_matchups.append({"name": "Ensimmäinen kierros", "matchups": r1})
        # Round 2
        r2 = []
        for code in ["w-semi", "w-semi2", "e-semi", "e-semi2"]:
            user_pick = picks_data.get("round2", {}).get(f"{code}-winner")
            user_games = picks_data.get("round2Games", {}).get(code)
            if user_pick:
                r2.append(build_matchup_comparison(code, user_pick, user_games, "Toinen kierros"))
        round_matchups.append({"name": "Toinen kierros", "matchups": r2})
        # Round 3
        r3 = []
        for code in ["west-final", "east-final"]:
            user_pick = picks_data.get("round3", {}).get(f"{code}-winner")
            user_games = picks_data.get("round3Games", {}).get(code)
            if user_pick:
                r3.append(build_matchup_comparison(code, user_pick, user_games, "Konferenssifinaalit"))
        round_matchups.append({"name": "Konferenssifinaalit", "matchups": r3})
        # Final
        rf = []
        user_pick = picks_data.get("final", {}).get("cup-winner")
        user_games = picks_data.get("finalGames", {}).get("cup")
        if user_pick:
            rf.append(build_matchup_comparison("cup", user_pick, user_games, "Finaali"))
        round_matchups.append({"name": "Finaali", "matchups": rf})

        # Calculate points/corrects using score_module
        calculate_bracket_points(int(user_id))  # updates UserPoints
        user_points = UserPoints.query.filter_by(user_id=int(user_id)).first()

        # Get statistics across all users
        all_user_points = UserPoints.query.all()

        # Calculate statistics for each round
        round1_correct_values = [up.bracket_round1_correct for up in all_user_points if up.bracket_round1_correct is not None]
        round1_points_values = [up.bracket_round1_points for up in all_user_points if up.bracket_round1_points is not None]

        round2_correct_values = [up.bracket_round2_correct for up in all_user_points if up.bracket_round2_correct is not None]
        round2_points_values = [up.bracket_round2_points for up in all_user_points if up.bracket_round2_points is not None]

        round3_correct_values = [up.bracket_round3_correct for up in all_user_points if up.bracket_round3_correct is not None]
        round3_points_values = [up.bracket_round3_points for up in all_user_points if up.bracket_round3_points is not None]

        final_correct_values = [up.bracket_final_correct for up in all_user_points if up.bracket_final_correct is not None]
        final_points_values = [up.bracket_final_points for up in all_user_points if up.bracket_final_points is not None]

        # Calculate totals across all rounds
        total_correct_values = [(up.bracket_round1_correct or 0) + 
                               (up.bracket_round2_correct or 0) + 
                               (up.bracket_round3_correct or 0) + 
                               (up.bracket_final_correct or 0) for up in all_user_points]

        total_points_values = [(up.bracket_round1_points or 0) + 
                              (up.bracket_round2_points or 0) + 
                              (up.bracket_round3_points or 0) + 
                              (up.bracket_final_points or 0) for up in all_user_points]

        # Helper function to safely calculate average
        def safe_avg(values):
            return sum(values) / len(values) if values else 0

        # Build rounds summary for dashboard
        rounds = [
            {
                "name": "1. kierros",
                "correct": user_points.bracket_round1_correct,
                "avgCorrect": round(safe_avg(round1_correct_values), 1),
                "bestCorrect": max(round1_correct_values, default=0),
                "points": user_points.bracket_round1_points,
                "avgPoints": round(safe_avg(round1_points_values), 1),
                "bestPoints": max(round1_points_values, default=0)
            },
            {
                "name": "2. kierros",
                "correct": user_points.bracket_round2_correct,
                "avgCorrect": round(safe_avg(round2_correct_values), 1),
                "bestCorrect": max(round2_correct_values, default=0),
                "points": user_points.bracket_round2_points,
                "avgPoints": round(safe_avg(round2_points_values), 1),
                "bestPoints": max(round2_points_values, default=0)
            },
            {
                "name": "3. Kierros",
                "correct": user_points.bracket_round3_correct,
                "avgCorrect": round(safe_avg(round3_correct_values), 1),
                "bestCorrect": max(round3_correct_values, default=0),
                "points": user_points.bracket_round3_points,
                "avgPoints": round(safe_avg(round3_points_values), 1),
                "bestPoints": max(round3_points_values, default=0)
            },
            {
                "name": "Finaali",
                "correct": user_points.bracket_final_correct,
                "avgCorrect": round(safe_avg(final_correct_values), 1),
                "bestCorrect": max(final_correct_values, default=0),
                "points": user_points.bracket_final_points,
                "avgPoints": round(safe_avg(final_points_values), 1),
                "bestPoints": max(final_points_values, default=0)
            }
        ]
        summary = {
            "rounds": rounds,
            "totalCorrect": sum(r["correct"] for r in rounds),
            "avgTotalCorrect": round(safe_avg(total_correct_values), 1),
            "bestTotalCorrect": max(total_correct_values, default=0),
            "avgTotalPoints": round(safe_avg(total_points_values), 1),
            "bestTotalPoints": max(total_points_values, default=0),
            "completed": sum(r["correct"] for r in rounds),
            "total": 15,  # 8+4+2+1
            "roundMatchups": round_matchups
        }
        return jsonify(summary), 200
    except Exception as e:
        print("Error in get_bracket_summary:", str(e))
        return jsonify({"error": str(e)}), 500

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
                    "predictions": 0,
                    "predictionsR1": 0,
                    "predictionsR2": 0,
                    "predictionsR3": 0,
                    "predictionsFinal": 0
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
                "predictions": user_points.predictions_total_points,
                "predictionsR1": user_points.predictions_r1_points,
                "predictionsR2": user_points.predictions_r2_points,
                "predictionsR3": user_points.predictions_r3_points,
                "predictionsFinal": user_points.predictions_final_points
            }
        }), 200
    
    except Exception as e:
        print(f"Error getting user stats: {str(e)}")
        return jsonify({"error": f"Failed to retrieve user stats: {str(e)}"}), 500

@app.route("/api/leaderboard", methods=["GET"])
def get_leaderboard():
    """
    Return leaderboard with real user points and correct ranking.
    Rank by total points (desc), then by number of playoff series correctly predicted (desc).
    """
    users = User.query.all()
    if not users:
        return jsonify({"error": "No users found"}), 404

    leaderboard = []
    # Gather all user points and corrects
    for user in users:
        points = UserPoints.query.filter_by(user_id=user.id).first()
        if points:

            bracket_points = points.bracket_total_points or 0
            lineup_points = points.lineup_total_points or 0
            predictions_points = points.predictions_total_points or 0
            total_points = bracket_points + lineup_points + predictions_points
            # Sum of all correct series predictions
            correct_series = (
                (points.bracket_round1_correct or 0)
                + (points.bracket_round2_correct or 0)
                + (points.bracket_round3_correct or 0)
                + (points.bracket_final_correct or 0)
            )
        else:
            total_points = 0
            bracket_points = 0
            lineup_points = 0
            predictions_points = 0
            correct_series = 0
        leaderboard.append({
            "id": user.id,
            "username": user.username,
            "teamName": user.team_name,
            "logoUrl": user.selected_logo_url,
            "totalPoints": total_points,
            "bracketPoints": bracket_points,
            "lineupPoints": lineup_points,
            "predictionsPoints": predictions_points,
            "correctSeries": correct_series
        })

    # Sort: totalPoints desc, then correctSeries desc
    leaderboard.sort(key=lambda x: (-x["totalPoints"], -x["correctSeries"]))

    # Assign ranks (1-based, ties get same rank, next rank is skipped)
    last_points = last_correct = None
    last_rank = 0
    for idx, entry in enumerate(leaderboard):
        if (entry["totalPoints"], entry["correctSeries"]) != (last_points, last_correct):
            last_rank = idx + 1
            last_points = entry["totalPoints"]
            last_correct = entry["correctSeries"]
        entry["rank"] = last_rank
        entry.pop("correctSeries", None)

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
                "matchup_code": m.matchup_code,
                # Add result information if available
                "result": {
                    "winner": m.result.winner,
                    "games": m.result.games
                } if m.result else None
            } for m in east_matchups]
            
            result["west"] = [{
                "id": m.id,
                "team1": m.team1,
                "team2": m.team2,
                "round": m.round,
                "conference": m.conference,
                "matchup_code": m.matchup_code,
                # Add result information if available
                "result": {
                    "winner": m.result.winner,
                    "games": m.result.games
                } if m.result else None
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
                    "matchup_code": final.matchup_code,
                    # Add result information if available
                    "result": {
                        "winner": final.result.winner,
                        "games": final.result.games
                    } if final.result else None
                }
        
        return jsonify(result), 200
        
    except Exception as e:
        print("Error getting round matchups:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/bracket/delete-result/<string:matchup_code>', methods=['DELETE'])
def delete_matchup_result(matchup_code):
    """
    Delete a matchup result by its matchup_code
    """
    try:
        # Find the result by matchup code
        result = MatchupResult.query.filter_by(matchup_code=matchup_code).first()
        
        if not result:
            return jsonify({"error": "Result not found"}), 404
        
        # Delete the result
        db.session.delete(result)
        db.session.commit()
        
        return jsonify({"message": f"Result for matchup {matchup_code} deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting matchup result: {e}")
        return jsonify({"error": f"Failed to delete result: {str(e)}"}), 500

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

@app.route('/api/registration-codes', methods=['GET'])
def get_registration_codes():
    """
    Get all registration codes from the database
    """
    try:
        codes = RegistrationCode.query.all()
        codes_data = [
            {
                'id': code.id,
                'code': code.code,
                'created_at': code.created_at.isoformat(),
                'is_used': code.is_used
            }
            for code in codes
        ]
        
        return jsonify(codes_data), 200
    except Exception as e:
        print(f"Error fetching registration codes: {e}")
        return jsonify({"error": "Failed to fetch registration codes"}), 500

@app.route('/api/registration-codes', methods=['POST'])
def create_new_registration_codes():
    """
    Generate new registration codes
    """
    data = request.json
    amount = data.get('amount', 1)
    
    if not isinstance(amount, int) or amount <= 0:
        return jsonify({"error": "Amount must be a positive integer"}), 400
        
    try:
        # Use the existing function from utils.py to generate codes
        from utils import generate_random_code
        
        new_codes = []
        for _ in range(amount):
            code_value = generate_random_code()
            new_code = RegistrationCode(
                code=code_value,
                created_at=datetime.now(timezone.utc),
                is_used=False
            )
            db.session.add(new_code)
            new_codes.append(code_value)
            
        db.session.commit()
        
        return jsonify({
            "message": f"{amount} registration codes created successfully",
            "codes": new_codes
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating registration codes: {e}")
        return jsonify({"error": f"Failed to create registration codes: {str(e)}"}), 500

@app.route('/api/users', methods=['GET'])
def get_all_users():
    """
    Get all users with their logo information
    """
    try:
        users = User.query.all()
        users_data = [
            {
                'id': user.id,
                'username': user.username,
                'team_name': user.team_name,
                'logo1_url': user.logo1_url,
                'logo2_url': user.logo2_url,
                'logo3_url': user.logo3_url,
                'logo4_url': user.logo4_url,
                'selected_logo_url': user.selected_logo_url,
                'is_admin': user.is_admin
            }
            for user in users
        ]
        
        return jsonify(users_data), 200
    except Exception as e:
        print(f"Error fetching users: {e}")
        return jsonify({"error": "Failed to fetch users"}), 500

@app.route('/api/users/<int:user_id>/logos', methods=['PUT'])
def update_user_logos(user_id):
    """
    Update a user's logo URLs
    """
    data = request.json

    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Update logo URLs if provided
        if 'logo1_url' in data:
            user.logo1_url = data['logo1_url']
        if 'logo2_url' in data:
            user.logo2_url = data['logo2_url']
        if 'logo3_url' in data:
            user.logo3_url = data['logo3_url']
        if 'logo4_url' in data:
            user.logo4_url = data['logo4_url']
        if 'selected_logo_url' in data:
            user.selected_logo_url = data['selected_logo_url']

        db.session.commit()

        return jsonify({
            "message": "User logos updated successfully",
            "user": {
                'id': user.id,
                'username': user.username,
                'team_name': user.team_name,
                'logo1_url': user.logo1_url,
                'logo2_url': user.logo2_url,
                'logo3_url': user.logo3_url,
                'logo4_url': user.logo4_url,
                'selected_logo_url': user.selected_logo_url
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating user logos: {e}")
        return jsonify({"error": f"Failed to update user logos: {str(e)}"}), 500

@app.route('/api/headlines', methods=['GET'])
def get_headlines():
    """
    Get active headlines, optionally filtered by team name
    """
    team_name = request.args.get('team_name')
    
    try:
        query = Headline.query.filter_by(is_active=True)
        
        # If team_name is provided, get team-specific headlines plus global ones (where team_name is null)
        if team_name:
            query = query.filter((Headline.team_name == team_name) | (Headline.team_name.is_(None)))
        
        # Order by newest first
        headlines = query.order_by(Headline.created.desc()).all()
        
        headline_data = [
            {
                'id': h.id,
                'headline': h.headline,
                'created': h.created.isoformat(),
                'team_name': h.team_name
            }
            for h in headlines
        ]
        
        return jsonify(headline_data), 200
    
    except Exception as e:
        print(f"Error fetching headlines: {e}")
        return jsonify({"error": f"Failed to fetch headlines: {str(e)}"}), 500

@app.route('/api/headlines', methods=['POST'])
def create_headline():
    """
    Create a new headline
    """
    data = request.json
    
    if not data or 'headline' not in data:
        return jsonify({"error": "Missing headline text"}), 400
    
    headline_text = data.get('headline')
    team_name = data.get('team_name')  # Can be None for global headlines
    
    try:
        new_headline = Headline(
            headline=headline_text,
            team_name=team_name,
            created=datetime.now(timezone.utc),
            is_active=True
        )
        
        db.session.add(new_headline)
        db.session.commit()
        
        return jsonify({
            "message": "Headline created successfully",
            "id": new_headline.id
        }), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"Error creating headline: {e}")
        return jsonify({"error": f"Failed to create headline: {str(e)}"}), 500

@app.route('/api/admin/headlines', methods=['GET'])
def get_all_headlines():
    """
    Admin endpoint to get all headlines, including inactive ones
    """
    try:
        headlines = Headline.query.order_by(Headline.created.desc()).all()
        
        headline_data = [
            {
                'id': h.id,
                'headline': h.headline,
                'created': h.created.isoformat(),
                'team_name': h.team_name,
                'is_active': h.is_active
            }
            for h in headlines
        ]
        
        return jsonify(headline_data), 200
    
    except Exception as e:
        print(f"Error fetching all headlines: {e}")
        return jsonify({"error": f"Failed to fetch headlines: {str(e)}"}), 500

@app.route('/api/admin/headlines/<int:headline_id>', methods=['PUT'])
def update_headline(headline_id):
    """
    Update a headline's text, team, or active status
    """
    data = request.json
    
    try:
        headline = Headline.query.get(headline_id)
        if not headline:
            return jsonify({"error": "Headline not found"}), 404
        
        if 'headline' in data:
            headline.headline = data['headline']
        if 'team_name' in data:
            headline.team_name = data['team_name']
        if 'is_active' in data:
            headline.is_active = data['is_active']
        
        db.session.commit()
        print(f"Updated headline: {headline.headline} (ID: {headline.id})")
        return jsonify({
            "message": "Headline updated successfully",
            "headline": {
                'id': headline.id,
                'headline': headline.headline,
                'created': headline.created.isoformat(),
                'team_name': headline.team_name,
                'is_active': headline.is_active
            }
        }), 200
    
    except Exception as e:
        db.session.rollback()
        print(f"Error updating headline: {e}")
        return jsonify({"error": f"Failed to update headline: {str(e)}"}), 500

@app.route('/api/admin/headlines/<int:headline_id>', methods=['DELETE'])
def delete_headline(headline_id):
    """
    Delete a headline
    """
    try:
        headline = Headline.query.get(headline_id)
        if not headline:
            return jsonify({"error": "Headline not found"}), 404

        db.session.delete(headline)
        db.session.commit()

        return jsonify({"message": "Headline deleted successfully"}, 200)

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting headline: {e}")
        return jsonify({"error": f"Failed to delete headline: {str(e)}"}), 500

@app.route('/api/deadline/status', methods=['GET'])
def get_deadline_status():
    """
    Get the status of the playoff bracket and lineup deadline
    """
    deadline_passed = is_deadline_passed()
    time_remaining = get_time_until_deadline()
    grace_period_active = is_grace_period_active()
    grace_period_end = GRACE_PERIOD_END.isoformat()
    return jsonify({
        "deadline_passed": deadline_passed,
        "time_remaining": time_remaining,
        "deadline_timestamp": get_deadline_from_db().isoformat(),
        "grace_period_active": grace_period_active,
        "grace_period_end": grace_period_end
    }), 200

@app.route('/api/admin/settings/deadline', methods=['PUT'])
def update_deadline():
    """
    Admin endpoint to update the playoff deadline
    """
    data = request.get_json()
    
    if not data or 'deadline' not in data:
        return jsonify({"error": "Missing deadline parameter"}), 400
        
    try:
        # Parse the deadline string to datetime
        deadline_str = data['deadline']
        new_deadline = datetime.fromisoformat(deadline_str)
        
        # Ensure datetime has timezone info
        if new_deadline.tzinfo is None:
            new_deadline = new_deadline.replace(tzinfo=timezone.utc)
            
        # Update the setting in database
        setting = Setting.query.filter_by(key='playoff_deadline').first()
        if not setting:
            setting = Setting(
                key='playoff_deadline',
                value=new_deadline.isoformat(),
                description='Deadline for playoff bracket, lineup, and predictions submissions'
            )
            db.session.add(setting)
        else:
            setting.value = new_deadline.isoformat()
            
        db.session.commit()
        
        return jsonify({
            "message": "Deadline updated successfully",
            "deadline": new_deadline.isoformat(),
            "deadline_passed": datetime.now(timezone.utc) >= new_deadline,
            "time_remaining": get_time_until_deadline()
        }), 200
        
    except ValueError:
        return jsonify({"error": "Invalid deadline format. Expected ISO format datetime string."}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update deadline: {str(e)}"}), 500

@app.route('/api/admin/settings/deadline', methods=['GET'])
def get_admin_deadline():
    """
    Admin endpoint to get the current playoff deadline
    """
    deadline = get_deadline_from_db()
    
    return jsonify({
        "deadline": deadline.isoformat(),
        "deadline_passed": datetime.now(timezone.utc) >= deadline,
        "time_remaining": get_time_until_deadline()
    }), 200

@app.route('/api/admin/trigger-prediction-check', methods=['POST'])
def trigger_prediction_check():
    """
    Admin endpoint to check and score top 3 predictions for a given round.
    Expects JSON: {"round": 1|2|3|4}
    """
    import json
    data = request.get_json()
    round_num = int(data.get('round', 1))
    if round_num not in [1, 2, 3, 4]:
        return jsonify({"error": "Invalid round number"}), 400

    # Get current top 3 for each category (with stat value)
    standings = get_current_standings()
    # standings: {category: [player_obj, ...]}

    # For each user, check predictions and award points
    users = User.query.all()
    for user in users:
        prediction = Prediction.query.filter_by(user_id=user.id).first()
        if not prediction:
            continue
        predictions_data = json.loads(prediction.predictions_json)
        user_points = UserPoints.query.filter_by(user_id=user.id).first()
        if not user_points:
            user_points = UserPoints(user_id=user.id)
            db.session.add(user_points)
        round_points = 0
        for category, curr_top3 in standings.items():
            # Get user's picks for this category
            user_picks = predictions_data.get(category, [])
            # Only compare by player id
            curr_top3_ids = set([p.id for p in curr_top3])
            for pick in user_picks:
                pick_id = pick.get('id') if isinstance(pick, dict) else None
                if pick_id and pick_id in curr_top3_ids:
                    round_points += 1
        # Write to correct column
        if round_num == 1:
            user_points.predictions_r1_points = round_points
        elif round_num == 2:
            user_points.predictions_r2_points = round_points
        elif round_num == 3:
            user_points.predictions_r3_points = round_points
        elif round_num == 4:
            user_points.predictions_final_points = round_points
        # Update total
        user_points.predictions_total_points = (
            (user_points.predictions_r1_points or 0) +
            (user_points.predictions_r2_points or 0) +
            (user_points.predictions_r3_points or 0) +
            (user_points.predictions_final_points or 0)
        )
        user_points.update_total_points()
    db.session.commit()
    return jsonify({"status": "Prediction check complete for round", "round": round_num}), 200

@app.route('/api/admin/trigger-bracket-recount', methods=['POST'])
def trigger_bracket_recount():
    """
    Admin endpoint to recalculate bracket points for all users.
    """
    from score_module import calculate_bracket_points
    users = User.query.all()
    for user in users:
        calculate_bracket_points(user.id)
    db.session.commit()
    return jsonify({"message": "Bracket points recounted for all users."}), 200

if __name__ == '__main__':
    app.run(debug=True)
    with app.app_context():
        db.create_all()

    print(f"Server running on http://localhost:5000")
