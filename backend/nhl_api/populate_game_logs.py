import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import time
from datetime import datetime
from models import db, Player, Goalie, GameLog
from flask import Flask
from config import Config

def fetch_and_store_game_logs():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    with app.app_context():
        # Skaters
        players = Player.query.all()
        total_players = len(players)
        print(f"\n🏒 Processing {total_players} skaters...")
        
        for idx, player in enumerate(players, 1):
            print(f"Processing player {idx}/{total_players}: {player.first_name} {player.last_name}")
            api_id = player.api_id
            url = f"https://api-web.nhle.com/v1/player/{api_id}/game-log/20232024/3"
            try:
                resp = requests.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    for game in data.get("gameLog", []):
                        game_id = str(game.get("gameId"))
                        game_date = datetime.strptime(game.get("gameDate"), "%Y-%m-%d")
                        team = game.get("teamAbbrev", "")
                        opponent = game.get("opponentAbbrev", "")
                        home = game.get("homeRoad", "R") == "H"
                        goals = game.get("goals", 0)
                        assists = game.get("assists", 0)
                        points = game.get("points", 0)
                        plus_minus = game.get("plusMinus", 0)
                        # Fetch start time from gamecenter endpoint
                        start_time_utc = None
                        try:
                            landing_url = f"https://api-web.nhle.com/v1/gamecenter/{game_id}/landing"
                            landing_resp = requests.get(landing_url)
                            if landing_resp.status_code == 200:
                                landing_data = landing_resp.json()
                                start_time_str = landing_data.get("startTimeUTC")
                                if start_time_str:
                                    start_time_utc = datetime.strptime(start_time_str, "%Y-%m-%dT%H:%M:%SZ")
                        except Exception as e:
                            print(f"Error fetching start time for game {game_id}: {e}")
                        # Check if already exists
                        exists = GameLog.query.filter_by(api_id=api_id, game_id=game_id).first()
                        if not exists:
                            log = GameLog(
                                player_id=player.id,
                                api_id=api_id,
                                is_goalie=False,
                                game_id=game_id,
                                game_date=game_date,
                                team=team,
                                opponent=opponent,
                                home=home,
                                player_name=f"{player.first_name} {player.last_name}",
                                goals=goals,
                                assists=assists,
                                points=points,
                                plus_minus=plus_minus,
                                start_time_utc=start_time_utc
                            )
                            db.session.add(log)
                            print(f"Added skater game log: {player.first_name} {player.last_name} {game_id}")
                else:
                    print(f"❌ Failed to fetch logs for {player.first_name} {player.last_name}")
            except Exception as e:
                print(f"❌ Error fetching logs for {player.first_name} {player.last_name}: {e}")
            time.sleep(0.1)
            
        # Goalies
        goalies = Goalie.query.all()
        total_goalies = len(goalies)
        print(f"\n🥅 Processing {total_goalies} goalies...")
        
        for idx, goalie in enumerate(goalies, 1):
            print(f"Processing goalie {idx}/{total_goalies}: {goalie.first_name} {goalie.last_name}")
            api_id = goalie.api_id
            url = f"https://api-web.nhle.com/v1/player/{api_id}/game-log/20232024/3"
            try:
                resp = requests.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    for game in data.get("gameLog", []):
                        game_id = str(game.get("gameId"))
                        game_date = datetime.strptime(game.get("gameDate"), "%Y-%m-%d")
                        team = game.get("teamAbbrev", "")
                        opponent = game.get("opponentAbbrev", "")
                        home = game.get("homeRoad", "R") == "H"
                        wins = game.get("decision", "") == "W"
                        shutouts = game.get("shutouts", 0)
                        saves = game.get("saves", 0)
                        shots = game.get("shotsAgainst", 0)
                        goals_against = game.get("goalsAgainst", 0)
                        # Fetch start time from gamecenter endpoint
                        start_time_utc = None
                        try:
                            landing_url = f"https://api-web.nhle.com/v1/gamecenter/{game_id}/landing"
                            landing_resp = requests.get(landing_url)
                            if landing_resp.status_code == 200:
                                landing_data = landing_resp.json()
                                start_time_str = landing_data.get("startTimeUTC")
                                if start_time_str:
                                    start_time_utc = datetime.strptime(start_time_str, "%Y-%m-%dT%H:%M:%SZ")
                        except Exception as e:
                            print(f"Error fetching start time for game {game_id}: {e}")
                        # Check if already exists
                        exists = GameLog.query.filter_by(api_id=api_id, game_id=game_id).first()
                        if not exists:
                            log = GameLog(
                                player_id=goalie.id,
                                api_id=api_id,
                                is_goalie=True,
                                game_id=game_id,
                                game_date=game_date,
                                team=team,
                                opponent=opponent,
                                home=home,
                                player_name=f"{goalie.first_name} {goalie.last_name}",
                                wins=1 if wins else 0,
                                shutouts=shutouts,
                                saves=saves,
                                shots=shots,
                                goals_against=goals_against,
                                start_time_utc=start_time_utc
                            )
                            db.session.add(log)
                            print(f"Added goalie game log: {goalie.first_name} {goalie.last_name} {game_id}")
                else:
                    print(f"❌ Failed to fetch logs for {goalie.first_name} {goalie.last_name}")
            except Exception as e:
                print(f"❌ Error fetching logs for {goalie.first_name} {goalie.last_name}: {e}")
            time.sleep(0.1)
            
        db.session.commit()
        print(f"\n✅ Game logs updated successfully!")
        print(f"   Processed {total_players} skaters and {total_goalies} goalies.")

if __name__ == "__main__":
    fetch_and_store_game_logs()
