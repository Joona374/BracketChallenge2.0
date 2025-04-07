import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


import requests
import time
from flask import Flask
from config import Config
from db import db_engine as db
from models import Team, Player

def fetch_and_store_teams():
    teams_url = "https://api-web.nhle.com/v1/standings/now"
    response = requests.get(teams_url)
    if response.status_code != 200:
        print("Failed to fetch teams data")
        return

    data = response.json()
    teams_data = data.get("standings", [])
    for team in teams_data:
        # Extract fields from the API response
        name = team.get("teamName", {}).get("default", "")
        abbr = team.get("teamAbbrev", {}).get("default", "")
        logo_url = team.get("teamLogo", "")
        
        if not abbr:
            continue  # Skip if no abbreviation is provided
        
        # Check if the team is already in the DB
        existing_team = Team.query.filter_by(abbr=abbr).first()
        if not existing_team:
            new_team = Team(name=name, abbr=abbr, logo_url=logo_url)
            db.session.add(new_team)
            print(f"Added team: {name} ({abbr})")
    
    db.session.commit()

def fetch_and_store_players_for_team(abbr):
    roster_url = f'https://api-web.nhle.com/v1/roster/{abbr}/current'
    roster_response = requests.get(roster_url)
    if roster_response.status_code != 200:
        print(f"Failed to fetch roster for {abbr}")
        return
    
    roster_data = roster_response.json()
    # Combine forwards, defensemen, and goalies
    players_list = (
        roster_data.get("forwards", []) +
        roster_data.get("defensemen", []) +
        roster_data.get("goalies", [])
    )
    
    for player in players_list:
        api_id = player.get("id")
        first_name = player.get("firstName", {}).get("default", "")
        last_name = player.get("lastName", {}).get("default", "")
        position = player.get("positionCode", "")
        jersey_number = player.get("sweaterNumber", "")
        birth_country = player.get("birthCountry", "")
        birth_year = None
        birth_date = player.get("birthDate", "")
        if birth_date:
            birth_year = int(birth_date.split("-")[0])
        headshot = player.get("headshot", "")
        
        # Get stats via the landing endpoint
        landing_url = f"https://api-web.nhle.com/v1/player/{api_id}/landing"
        landing_response = requests.get(landing_url)
        if landing_response.status_code == 200:
            landing_data = landing_response.json()
            stats = landing_data.get("featuredStats", {}).get("regularSeason", {}).get("subSeason", {})
            reg_gp = stats.get("gamesPlayed", 0)
            reg_goals = stats.get("goals", 0)
            reg_assists = stats.get("assists", 0)
            reg_points = stats.get("points", 0)
            reg_plus_minus = stats.get("plusMinus", 0)
        else:
            reg_gp = reg_goals = reg_assists = reg_points = reg_plus_minus = 0
        
        # Use placeholders for playoff stats (update later when available)
        playoff_goals = playoff_assists = playoff_points = playoff_plus_minus = 0
        
        # Check if the player already exists in the DB using the API id
        existing_player = Player.query.filter_by(api_id=api_id).first()
        if existing_player:
            print(f"Player {first_name} {last_name} already exists, skipping.")
            continue

        if birth_year and 2025 - birth_year <= 23:
            is_U23 = True
        else:
            is_U23 = False
        
        new_player = Player(
            api_id=api_id,
            first_name=first_name,
            last_name=last_name,
            team_abbr=abbr,
            position=position,
            jersey_number=jersey_number,
            birth_country=birth_country,
            birth_year=birth_year,
            headshot=headshot,
            is_U23=is_U23,
            price=1,  # Default price, can be updated later with logic
            reg_gp=reg_gp,
            reg_goals=reg_goals,
            reg_assists=reg_assists,
            reg_points=reg_points,
            reg_plus_minus=reg_plus_minus,
            playoff_goals=playoff_goals,
            playoff_assists=playoff_assists,
            playoff_points=playoff_points,
            playoff_plus_minus=playoff_plus_minus
        )
        db.session.add(new_player)
        print(f"Added player: {first_name} {last_name} ({abbr})")
        time.sleep(0.1)  # Small delay to be kind to the API
    
    db.session.commit()

def populate_db():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        db.create_all()  # Create tables if they don't exist
        print("Populating teams...")
        fetch_and_store_teams()
        
        # Now fetch players for each team in our teams table.
        teams = Team.query.all()
        for team in teams:
            print(f"Fetching players for team: {team.abbr}")
            fetch_and_store_players_for_team(team.abbr)

if __name__ == '__main__':
    populate_db()
