from models import Pick, MatchupResult, UserPoints, db
import json
from flask import Flask
from config import Config

def calculate_bracket_points(user_id):
    """
    Calculate points for a user's bracket predictions and update the UserPoints table.
    
    Args:
        user_id (int): The user ID to calculate points for
        
    Returns:
        int: Total points earned from bracket predictions
    """
    # Get the user's picks
    user_picks = Pick.query.filter_by(user_id=user_id).first()
    if not user_picks:
        print(f"No picks found for user_id {user_id}")
        return 0
        
    try:
        # Parse the JSON data
        picks_data = json.loads(user_picks.picks_json)
    except json.JSONDecodeError:
        print(f"Invalid JSON data for user_id {user_id}")
        return 0
    
    # Get all actual results
    all_results = MatchupResult.query.all()
    results_by_code = {result.matchup_code: result for result in all_results}
    
    # Dictionary to store user predictions (winner and games) for each matchup
    user_predictions = {}
    
    # Process Round 1
    round1 = picks_data.get("round1", {})
    round1_games = picks_data.get("round1Games", {})
    for code in ["W1", "W2", "W3", "W4", "E1", "E2", "E3", "E4"]:
        winner = round1.get(code)
        games = round1_games.get(code)
        if winner:  # Only add if a prediction was made
            user_predictions[code] = {
                "winner": winner,
                "games": games
            }
    
    # Process Round 2
    round2 = picks_data.get("round2", {})
    round2_games = picks_data.get("round2Games", {})
    for code in ["w-semi", "w-semi2", "e-semi", "e-semi2"]:
        winner_key = f"{code}-winner"
        winner = round2.get(winner_key)
        games = round2_games.get(code)
        if winner:  # Only add if a prediction was made
            user_predictions[code] = {
                "winner": winner,
                "games": games
            }
    
    # Process Round 3
    round3 = picks_data.get("round3", {})
    round3_games = picks_data.get("round3Games", {})
    for code in ["west-final", "east-final"]:
        winner_key = f"{code}-winner"
        winner = round3.get(winner_key)
        games = round3_games.get(code)
        if winner:  # Only add if a prediction was made
            user_predictions[code] = {
                "winner": winner,
                "games": games
            }
    
    # Process Final
    final = picks_data.get("final", {})
    final_games = picks_data.get("finalGames", {})
    winner = final.get("cup-winner")
    games = final_games.get("cup")
    if winner:  # Only add if a prediction was made
        user_predictions["cup"] = {
            "winner": winner,
            "games": games
        }
    
    # Track points and correct picks by round
    round1_correct = 0
    round1_points = 0
    round2_correct = 0
    round2_points = 0
    round3_correct = 0
    round3_points = 0
    final_correct = 0
    final_points = 0
    
    # Calculate points
    total_points = 0
    print(f"Bracket scoring for user_id {user_id}:")
    print("-" * 80)
    print(f"{'Matchup':<10} {'Actual Winner':<15} {'Actual Games':<12} {'User Pick':<15} {'User Games':<10} {'Points'}")
    print("-" * 80)
    
    for matchup_code, prediction in user_predictions.items():
        actual_result = results_by_code.get(matchup_code)

        if matchup_code == "cup":
            points_to_give = 16
        elif matchup_code in ["west-final", "east-final"]:
            points_to_give = 8
        elif matchup_code in ["w-semi", "w-semi2", "e-semi", "e-semi2"]:
            points_to_give = 4
        else:
            points_to_give = 2
        
        points = 0
        actual_winner = "N/A"
        actual_games = "N/A"
        
        if actual_result:
            actual_winner = actual_result.winner
            actual_games = actual_result.games
            
            # Check if winner is correct
            if actual_result.winner == prediction["winner"]:
                points += points_to_give
                
                # Track correct picks by round
                if matchup_code == "cup":
                    final_correct = 1
                elif matchup_code in ["west-final", "east-final"]:
                    round3_correct += 1
                elif matchup_code in ["w-semi", "w-semi2", "e-semi", "e-semi2"]:
                    round2_correct += 1
                else:  # Round 1
                    round1_correct += 1
                
                # Check if games is also correct
                if actual_result.games == prediction["games"]:
                    points += points_to_give
                    
            # Add points to the appropriate round total
            if matchup_code == "cup":
                final_points = points
            elif matchup_code in ["west-final", "east-final"]:
                round3_points += points
            elif matchup_code in ["w-semi", "w-semi2", "e-semi", "e-semi2"]:
                round2_points += points
            else:  # Round 1
                round1_points += points
                    
        print(f"{matchup_code:<10} {actual_winner:<15} {actual_games:<12} {prediction['winner']:<15} {prediction['games']:<10} {points}")
        total_points += points
    
    print("-" * 80)
    print(f"Total bracket points: {total_points}")
    
    # Record points in the UserPoints table
    user_points = UserPoints.query.filter_by(user_id=user_id).first()
    if not user_points:
        # Create new record if none exists
        user_points = UserPoints(user_id=user_id)
        db.session.add(user_points)
    
    # Update bracket points
    user_points.bracket_round1_correct = round1_correct
    user_points.bracket_round1_points = round1_points
    
    user_points.bracket_round2_correct = round2_correct
    user_points.bracket_round2_points = round2_points
    
    user_points.bracket_round3_correct = round3_correct
    user_points.bracket_round3_points = round3_points
    
    user_points.bracket_final_correct = final_correct
    user_points.bracket_final_points = final_points
    

    
    # Save changes to the database
    db.session.commit()

    # Update total points
    user_points.update_total_points()

    # Save changes to the database again :D
    db.session.commit()

    print(f"Updated UserPoints record for user_id {user_id}")
    print(f"Round 1: {round1_correct} correct, {round1_points} points")
    print(f"Round 2: {round2_correct} correct, {round2_points} points")
    print(f"Round 3: {round3_correct} correct, {round3_points} points")
    print(f"Finals: {final_correct} correct, {final_points} points")
    print(f"Total bracket points: {user_points.bracket_total_points}")
    print(f"Total points across all games: {user_points.total_points}")
    
    return total_points

def calculate_lineup_points(user_id):
    """
    Calculate points for a user's lineup based on playoff stats and update UserPoints.
    Forwards: 2*goals + assists + plus_minus
    Defenders: 3*goals + assists + plus_minus
    Goalies: 1/game played + 1/win + 1/shutout + 1 if save% > 92%
    """
    from models import LineupHistory, Player, Goalie, UserPoints, db
    from sqlalchemy import and_
    
    lineup_entries = LineupHistory.query.filter_by(user_id=user_id).all()
    if not lineup_entries:
        print(f"No lineup history for user {user_id}")
        return 0
    total_points = 0
    for entry in lineup_entries:
        player = Player.query.get(entry.player_id)
        if player:
            # Forwards: L, C, R; Defenders: D (LD, RD slots)
            if player.position in ("L", "C", "R"):
                total_points += 2 * (player.playoff_goals or 0) + (player.playoff_assists or 0) + (player.playoff_plus_minus or 0)
            elif player.position == "D":
                total_points += 3 * (player.playoff_goals or 0) + (player.playoff_assists or 0) + (player.playoff_plus_minus or 0)
        else:
            goalie = Goalie.query.get(entry.player_id)
            if goalie:
                # 1/game played + 1/win + 1/shutout + 1 if save% > 92%
                total_points += (goalie.playoff_gp or 0)
                total_points += (goalie.playoff_wins or 0)
                total_points += (goalie.playoff_shutouts or 0)
                if goalie.playoff_save_pct and goalie.playoff_save_pct > 0.92:
                    total_points += 1
    user_points = UserPoints.query.filter_by(user_id=user_id).first()
    if not user_points:
        user_points = UserPoints(user_id=user_id)
        db.session.add(user_points)
    user_points.lineup_total_points = total_points
    user_points.update_total_points()
    db.session.commit()
    print(f"Updated lineup points for user {user_id}: {total_points}")
    return total_points

def calculate_lineup_points_from_gamelogs(user_id):
    """
    For each game log, check if the user had the player in their lineup at game start and for at least 2 hours after.
    If so, award points for that game and sum to user_points.lineup_total_points.
    Forwards: 2*goals + assists + plus_minus
    Defenders: 3*goals + assists + plus_minus
    Goalies: 1/game played + 1/win + 1/shutout + 1 if save% > 92%
    """
    from models import GameLog, LineupHistory, UserPoints, db, Player, Goalie
    from sqlalchemy import and_
    from datetime import timedelta

    total_points = 0
    game_logs = GameLog.query.order_by(GameLog.start_time_utc).all()
    for log in game_logs:
        lh = LineupHistory.query.filter_by(user_id=user_id, player_id=log.player_id).order_by(LineupHistory.added_at).all()
        eligible = False
        for entry in lh:
            if entry.added_at <= log.start_time_utc:
                if not entry.removed_at or entry.removed_at >= log.start_time_utc + timedelta(hours=2):
                    eligible = True
                    break
        if eligible:
            if not log.is_goalie:
                player = Player.query.filter_by(api_id=log.api_id).first()
                if player and player.position in ("L", "C", "R"):
                    total_points += 2 * (log.goals or 0) + (log.assists or 0) + (log.plus_minus or 0)
                elif player and player.position == "D":
                    total_points += 3 * (log.goals or 0) + (log.assists or 0) + (log.plus_minus or 0)
            else:
                # Goalie: 1/game played + 1/win + 1/shutout + 1 if save% > 92%
                total_points += 1  # game played
                total_points += (log.wins or 0)
                total_points += (log.shutouts or 0)
                if log.shots and log.saves is not None and log.shots > 0:
                    save_pct = log.saves / log.shots
                    if save_pct > 0.92:
                        total_points += 1
    user_points = UserPoints.query.filter_by(user_id=user_id).first()
    if not user_points:
        user_points = UserPoints(user_id=user_id)
        db.session.add(user_points)
    user_points.lineup_total_points = total_points
    user_points.update_total_points()
    db.session.commit()
    print(f"Updated lineup points for user {user_id}: {total_points}")
    return total_points

# You can add other scoring functions for lineup and predictions games here in the future

if __name__ == "__main__":
    # Create Flask app
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    # Run within app context
    with app.app_context():
        # Example usage
        user_id = 3  # Replace with actual user ID
        points = calculate_lineup_points_from_gamelogs(user_id)
        print(f"User {user_id} earned {points} points from their lineup.")
