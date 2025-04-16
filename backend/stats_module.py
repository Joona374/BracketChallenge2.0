from models import Player, Goalie, Prediction
from db import db_engine as db
import json

def get_penalty_leaders():
    """Get the current playoff penalty minute leaders"""
    print("Fetching penalty leaders...")
    players = Player.query.order_by(Player.reg_penalty_minutes.desc()).limit(3).all()
    print(f"Found penalty leaders: {[f'{p.first_name} {p.last_name} ({p.reg_penalty_minutes} PIM)' for p in players]}")
    return players

def get_goal_leaders():
    """Get the current playoff goal leaders"""
    print("Fetching goal leaders...")
    players = Player.query.order_by(Player.reg_goals.desc()).limit(3).all()
    print(f"Found goal leaders: {[f'{p.first_name} {p.last_name} ({p.reg_goals} goals)' for p in players]}")
    return players

def get_defense_point_leaders():
    """Get the current playoff point leaders among defensemen"""
    print("Fetching defense point leaders...")
    defensemen = Player.query.filter_by(position='D').order_by(Player.reg_points.desc()).limit(3).all()
    print(f"Found defense leaders: {[f'{p.first_name} {p.last_name} ({p.reg_points} points)' for p in defensemen]}")
    return defensemen

def get_u23_point_leaders():
    """Get the current playoff point leaders among U23 players"""
    print("Fetching U23 point leaders...")
    young_players = Player.query.filter_by(is_U23=True).order_by(Player.reg_points.desc()).limit(3).all()
    print(f"Found U23 leaders: {[f'{p.first_name} {p.last_name} ({p.reg_points} points)' for p in young_players]}")
    return young_players

def get_goalie_win_leaders():
    """Get the current playoff win leaders among goalies"""
    print("Fetching goalie win leaders...")
    goalies = Goalie.query.order_by(Goalie.reg_wins.desc()).limit(3).all()
    print(f"Found goalie leaders: {[f'{g.first_name} {g.last_name} ({g.reg_wins} wins)' for g in goalies]}")
    return goalies

def get_finnish_point_leaders():
    """Get the current playoff point leaders among Finnish players"""
    print("Fetching Finnish point leaders...")
    finns = Player.query.filter_by(birth_country='FIN').order_by(Player.reg_points.desc()).limit(3).all()
    print(f"Found Finnish leaders: {[f'{p.first_name} {p.last_name} ({p.reg_points} points)' for p in finns]}")
    return finns

def get_current_standings():
    """Get current standings for all prediction categories"""
    print("\nGetting current standings for all categories...")
    standings = {
        "penaltyMinutes": get_penalty_leaders(),
        "goals": get_goal_leaders(),
        "defensePoints": get_defense_point_leaders(),
        "U23Points": get_u23_point_leaders(),
        "goalieWins": get_goalie_win_leaders(),
        "finnishPoints": get_finnish_point_leaders()
    }
    print("\nFinal standings dictionary keys:", standings.keys())
    for category, leaders in standings.items():
        print(f"\n{category} leaders: {[f'{p.first_name} {p.last_name}' for p in leaders]}")
    return standings

def get_user_predictions_summary(user_id):
    """Get a user's predictions and compare them with current standings"""
    # Get the user's predictions
    prediction = Prediction.query.filter_by(user_id=user_id).first()
    if not prediction:
        return None

    try:
        predictions_data = json.loads(prediction.predictions_json)
        current_standings = get_current_standings()
        print(f"\nUser predictions: {predictions_data}")
        print(f"\nCurrent standings: {current_standings}")
        
        # Initialize summary structure
        summary = {
            "completed": 0,
            "totalToComplete": len(current_standings) * 3,  # 3 picks per category
            "categories": [],
            "totalCorrect": 0
        }
        
        # Process each category
        for category, curr_top3 in current_standings.items():
            if category in predictions_data:
                user_picks = predictions_data[category][:3]  # Get user's top 3 picks
                
                # Count correct picks by comparing names
                correct_picks = sum(1 for pick in user_picks if any(
                    pick == f"{p.first_name} {p.last_name}" 
                    for p in curr_top3
                ))
                
                category_summary = {
                    "name": category,
                    "userPicks": user_picks,
                    "currentTop3": curr_top3,  # Keep the full player objects
                    "correctPicks": correct_picks
                }
                
                summary["categories"].append(category_summary)
                summary["totalCorrect"] += correct_picks
                
                # Update completed count if we have actual standings
                if curr_top3:
                    summary["completed"] += 1
        
        print(summary)
        return summary
        
    except Exception as e:
        print(f"Error processing predictions: {str(e)}")
        return None