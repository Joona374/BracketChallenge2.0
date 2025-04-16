import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from config import Config
from db import db_engine as db
from nhl_api.populate_game_logs import fetch_and_store_game_logs
from nhl_api.update_prices import update_prices_after_games
from score_module import calculate_lineup_points_from_gamelogs
from models import User

if __name__ == "__main__":
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        print("--- Updating game logs ---")
        fetch_and_store_game_logs()
        
        print("--- Updating player and goalie prices ---")
        update_prices_after_games()
        
        print("--- Recalculating lineup points for all users ---")
        users = User.query.all()
        user_count = len(users)
        print(f"Found {user_count} users to update")
        
        for i, user in enumerate(users, 1):
            print(f"[{i}/{user_count}] Updating points for user {user.id}: {user.username}")
            points = calculate_lineup_points_from_gamelogs(user.id)
            print(f"   → {points} lineup points calculated")
            
        print("--- Daily update complete! ---")