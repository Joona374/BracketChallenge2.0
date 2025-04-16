import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import db, Player, Goalie, GameLog
from sqlalchemy import desc

def update_prices_after_games():
    # Update skater prices
    players = Player.query.all()
    for player in players:
        print(f"Updating price for player {player.first_name} {player.last_name}")
        latest_log = GameLog.query.filter_by(api_id=player.api_id, is_goalie=False).order_by(desc(GameLog.game_date)).first()
        if not latest_log:
            continue
        if player.last_price_update_game_id == latest_log.game_id:
            continue  # Already updated for this game
        # Calculate performance (example: 2*goals + assists + plus_minus)
        if player.position == 'D':
            perf = 3 * (latest_log.goals or 0) + (latest_log.assists or 0) + (latest_log.plus_minus or 0)
        else:
            perf = 2 * (latest_log.goals or 0) + (latest_log.assists or 0) + (latest_log.plus_minus or 0)
        # Map perf to price change: -3 or less = -5%, 0 = 0%, +4 or more = +5%, linear in between
        if perf <= -3:
            pct = -0.05
        elif perf == -2:
            pct = -0.03
        elif perf == -1:
            pct = -0.01
        elif perf == 0:
            pct = 0.0
        elif perf == 1:
            pct = 0.012
        elif perf == 2:
            pct = 0.027
        elif perf == 3:
            pct = 0.035
        elif perf >= 4:
            pct = 0.06
        else:
            pct = 0.0
        new_price = int(player.price * (1 + pct))
        new_price = max(100000, min(700000, new_price))
        player.price = new_price
        player.last_price_update_game_id = latest_log.game_id
        
    # Update goalie prices
    goalies = Goalie.query.all()
    for goalie in goalies:
        latest_log = GameLog.query.filter_by(api_id=goalie.api_id, is_goalie=True).order_by(desc(GameLog.game_date)).first()
        if not latest_log:
            continue
        if goalie.last_price_update_game_id == latest_log.game_id:
            continue
        # Calculate goalie performance: 1 for game played, 1 for win, 1 for shutout, 1 for save% > 92%
        perf = 1  # game played
        perf += (latest_log.wins or 0)
        perf += (latest_log.shutouts or 0)
        save_pct = None
        if latest_log.shots and latest_log.saves is not None and latest_log.shots > 0:
            save_pct = latest_log.saves / latest_log.shots
            if save_pct > 0.92:
                perf += 1
            elif save_pct < 0.83:
                perf -= 1
        # Map perf to price change: 0 = -5%, 1 = -2.5%, 2 = 0%, 3 = +2.5%, 4 = +5%
        if perf <= 0:
            pct = -0.05
        elif perf == 1:
            pct = -0.025
        elif perf == 2:
            pct = 0.0
        elif perf == 3:
            pct = 0.025
        elif perf >= 4:
            pct = 0.05
        else:
            pct = 0.0
        new_price = int(goalie.price * (1 + pct))
        new_price = max(100000, min(650000, new_price))
        goalie.price = new_price
        goalie.last_price_update_game_id = latest_log.game_id
    db.session.commit()

if __name__ == "__main__":
    from flask import Flask
    from config import Config
    from db import db_engine as db
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    with app.app_context():
        print("--- Updating player and goalie prices ---")
        update_prices_after_games()
        print("--- Prices updated successfully! ---")
        # Optionally, you can also run the following to see the updated prices
        players = Player.query.all()
        for player in players:
            print(f"{player.first_name} {player.last_name}: {player.initial_price} -> ${player.price}")
        goalies = Goalie.query.all()
        for goalie in goalies:
            print(f"{goalie.first_name} {goalie.last_name}: {goalie.initial_price} - > ${goalie.price}")
