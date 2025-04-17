import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


import requests
import time
from flask import Flask
from config import Config
from db import db_engine as db
from models import Team, Player, Goalie

MIN_PRICE = 180000
MAX_PRICE = 500000

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
    
    try:
        roster_response = requests.get(roster_url)
        roster_data = roster_response.json()
        
        # Get skaters (forwards and defensemen)
        skaters = (
            roster_data.get("forwards", []) +
            roster_data.get("defensemen", [])
        )
        
        # Get goalies separately
        goalies = roster_data.get("goalies", [])
        
        print(f"\n📋 Processing {len(skaters)} skaters and {len(goalies)} goalies for {abbr}")
        
        # Process skaters
        for player in skaters:
            api_id = player['id']
            first_name = player['firstName']['default']
            last_name = player['lastName']['default']
            position = player['positionCode']
            jersey_number = player.get('sweaterNumber', '')
            
            # Check if the player already exists in the DB using the API id
            existing_player = Player.query.filter_by(api_id=api_id).first()
            if existing_player:
                print(f"Player {first_name} {last_name} already exists, skipping.")
                continue
            
            # Get player info from the API
            player_url = f"https://api-web.nhle.com/v1/player/{api_id}/landing"
            player_response = requests.get(player_url)
            player_data = player_response.json()
            
            birth_country = player_data.get("birthCountry", "")
            birth_date = player_data.get("birthDate", "")
            birth_year = None
            if birth_date:
                birth_year = int(birth_date.split("-")[0])
            headshot = player.get("headshot", "")
            
            # Get stats via the landing endpoint
            landing_url = f"https://api-web.nhle.com/v1/player/{api_id}/landing"
            landing_response = requests.get(landing_url)
            if landing_response.status_code == 200:
                landing_data = landing_response.json()
                reg_stats = landing_data.get("featuredStats", {}).get("regularSeason", {}).get("subSeason", {})
                reg_gp = reg_stats.get("gamesPlayed", 0)
                reg_goals = reg_stats.get("goals", 0)
                reg_assists = reg_stats.get("assists", 0)
                reg_points = reg_stats.get("points", 0)
                reg_plus_minus = reg_stats.get("plusMinus", 0)
                reg_penalty_minutes = reg_stats.get("pim", 0)

                playoff_stats = landing_data.get("featuredStats", {}).get("playoffs", {}).get("subSeason", {})
                playoff_gp = playoff_stats.get("gamesPlayed", 0)
                playoff_goals = playoff_stats.get("goals", 0)
                playoff_assists = playoff_stats.get("assists", 0)
                playoff_points = playoff_stats.get("points", 0)
                playoff_plus_minus = playoff_stats.get("plusMinus", 0)
                playoff_penalty_minutes = playoff_stats.get("pim", 0)
            else:
                reg_gp = reg_goals = reg_assists = reg_points = reg_plus_minus = 0
                playoff_goals = playoff_assists = playoff_points = playoff_plus_minus = 0
            


            if birth_year and 2025 - birth_year <= 23:
                is_U23 = True
            else:
                is_U23 = False
            
            # Set a default price - will be updated later by calculate_prices()
            default_price = 200000
            
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
                price=default_price,  # Default price, will be updated later
                reg_gp=reg_gp,
                reg_goals=reg_goals,
                reg_assists=reg_assists,
                reg_points=reg_points,
                reg_plus_minus=reg_plus_minus,
                reg_penalty_minutes=reg_penalty_minutes,
                playoff_goals=playoff_goals,
                playoff_assists=playoff_assists,
                playoff_points=playoff_points,
                playoff_plus_minus=playoff_plus_minus,
                playoff_penalty_minutes=playoff_penalty_minutes
            )
            db.session.add(new_player)
            print(f"Added player: {first_name} {last_name} ({abbr})")
            time.sleep(0.1)  # Small delay to be kind to the API
        
        # Process goalies
        for goalie in goalies:
            api_id = goalie['id']
            first_name = goalie['firstName']['default']
            last_name = goalie['lastName']['default']
            position = goalie['positionCode']  # Should be 'G'
            jersey_number = goalie.get('sweaterNumber', '')
            
            # Check if the goalie already exists in the DB using the API id
            existing_goalie = Goalie.query.filter_by(api_id=api_id).first()
            if existing_goalie:
                print(f"Goalie {first_name} {last_name} already exists, skipping.")
                continue
            
            # Get goalie info from the API
            goalie_url = f"https://api-web.nhle.com/v1/player/{api_id}/landing"
            goalie_response = requests.get(goalie_url)
            goalie_data = goalie_response.json()
            
            birth_country = goalie_data.get("birthCountry", "")
            birth_date = goalie_data.get("birthDate", "")
            birth_year = None
            if birth_date:
                birth_year = int(birth_date.split("-")[0])
            headshot = goalie.get("headshot", "")
            
            # Get stats via the landing endpoint
            reg_stats = goalie_data.get("featuredStats", {}).get("regularSeason", {}).get("subSeason", {})
            reg_gp = reg_stats.get("gamesPlayed", 0)
            reg_gaa = reg_stats.get("goalsAgainstAvg", 0.0)
            reg_save_pct = reg_stats.get("savePctg", 0.0)
            reg_shutouts = reg_stats.get("shutouts", 0)
            reg_wins = reg_stats.get("wins", 0)
            
            playoff_stats = goalie_data.get("featuredStats", {}).get("playoffs", {}).get("subSeason", {})
            playoff_gp = playoff_stats.get("gamesPlayed", 0)
            playoff_gaa = playoff_stats.get("goalsAgainstAvg", 0.0)
            playoff_save_pct = playoff_stats.get("savePctg", 0.0)
            playoff_shutouts = playoff_stats.get("shutouts", 0)
            playoff_wins = playoff_stats.get("wins", 0)
            

            if birth_year and 2025 - birth_year <= 23:
                is_U23 = True
            else:
                is_U23 = False
            
            # Set a default price - will be updated later by calculate_prices()
            default_price = 200000
            
            new_goalie = Goalie(
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
                price=default_price,  # Default price, will be updated later
                reg_gp=reg_gp,
                reg_gaa=reg_gaa,
                reg_save_pct=reg_save_pct,
                reg_shutouts=reg_shutouts,
                reg_wins=reg_wins,
                playoff_gp=playoff_gp,
                playoff_gaa=playoff_gaa,
                playoff_save_pct=playoff_save_pct,
                playoff_shutouts=playoff_shutouts,
                playoff_wins=playoff_wins
            )
            db.session.add(new_goalie)
            print(f"Added goalie: {first_name} {last_name} ({abbr})")
            time.sleep(0.1)  # Small delay to be kind to the API
        
        db.session.commit()
        
    except Exception as e:
        print(f"❌ Error processing team {abbr}: {e}")
        db.session.rollback()

def test_player():
    player_id = "8478492"  # Example player ID
    player_url = f"https://api-web.nhle.com/v1/player/{player_id}/landing"
    
    try:
        player_response = requests.get(player_url)
        if player_response.status_code == 200:
            player_data = player_response.json()
            print(player_data)
        else:
            print(f"Failed to fetch data for player ID {player_id}")
    except Exception as e:
        print(f"Error fetching player data: {e}")

def calculate_prices():
    """
    Calculate player prices based on regular season performance.
    Scales prices between MIN_PRICE and MAX_PRICE based on performance.
    Formula: (2 * reg_goals + reg_assists + reg_plus_minus) / reg_gp
    """
    print("📊 Calculating player prices based on performance...")
    
    # Calculate prices for skaters
    players = Player.query.all()
    player_scores = []
    for player in players:
        print(f"Calculating price for player {player.first_name} {player.last_name}")
        # Skip players with no games played to avoid division by zero
        if not player.reg_gp or player.reg_gp == 0:
            performance = 0
        elif player.reg_gp < 5:
            performance = 0
        else:
            # Calculate performance using the formula
            if player.position in "L, R, C":
                performance = ((2 * player.reg_goals + player.reg_assists + player.reg_plus_minus) / player.reg_gp)
            elif player.position == "D":
                performance = ((3 * player.reg_goals + player.reg_assists + player.reg_plus_minus) / player.reg_gp)
    
        player_scores.append((player, performance))
    
    # Find min and max scores for skaters (excluding zeros)
    non_zero_scores = [score for _, score in player_scores if score > 0]
    if non_zero_scores:
        min_score = min(non_zero_scores)
        max_score = max(non_zero_scores)
        score_range = max_score - min_score
        price_range = MAX_PRICE - MIN_PRICE
        
        # Update prices for all skaters
        for player, score in player_scores:
            if score_range == 0:  # Avoid division by zero if all players have the same score
                player.price = MIN_PRICE
            else:
                # Scale the price between MIN_PRICE and MAX_PRICE
                normalized_score = (score - min_score) / score_range
                player.price = int(MIN_PRICE + (normalized_score * price_range))
                # ROUNDING THE PRICE TO THE NEAREST 1000
                player.price = round(player.price, -3)
                
                # Handle special cases for players with fewer than 10 or 20 games played
                if player.reg_gp < 5:
                    player.price = 250000
                elif player.reg_gp < 10:
                    player.price = int(player.price * 0.8)
                elif player.reg_gp < 20:
                    player.price = int(player.price * 0.85)
                
                # Ensure price stays within bounds
                player.price = max(MIN_PRICE, min(MAX_PRICE, player.price))
                player.initial_price = player.price  # Store the initial price for reference
                print(f"Updated price for {player.first_name} {player.last_name}: ${player.price/1000:.1f}K")

    # Now handle goalies separately
    goalies = Goalie.query.all()
    goalie_scores = []
    GOALIE_MAX_PRICE = 450000
    GOALIE_MIN_PRICE = 180000
    goalie_price_range = GOALIE_MAX_PRICE - GOALIE_MIN_PRICE
    
    for goalie in goalies:
        # Skip goalies with no games played
        if not goalie.reg_gp or goalie.reg_gp == 0:
            performance = 0
        else:
            # Custom formula for goalies: Wins are heavily weighted, plus bonus for good save% and GAA
            performance = (goalie.reg_wins + goalie.reg_shutouts + goalie.reg_gp) * goalie.reg_save_pct
        
        goalie_scores.append((goalie, performance))
    
    # Find min and max scores for goalies (excluding zeros)
    non_zero_goalie_scores = [score for _, score in goalie_scores if score > 0]
    if non_zero_goalie_scores:
        min_goalie_score = min(non_zero_goalie_scores)
        max_goalie_score = max(non_zero_goalie_scores)
        goalie_score_range = max_goalie_score - min_goalie_score
        
        # Update prices for all goalies
        for goalie, score in goalie_scores:
            if goalie_score_range == 0:  # Avoid division by zero
                goalie.price = GOALIE_MIN_PRICE
            else:
                # Scale the price between MIN_PRICE and MAX_PRICE
                normalized_score = (score - min_goalie_score) / goalie_score_range
                goalie.price = int(GOALIE_MIN_PRICE + (normalized_score * goalie_price_range))
                # ROUNDING THE PRICE TO THE NEAREST 1000
                goalie.price = round(goalie.price, -3)
                
                # Handle special cases for goalies with fewer games played

                
                # Ensure price stays within bounds
                goalie.price = max(GOALIE_MIN_PRICE, min(GOALIE_MAX_PRICE, goalie.price))
                goalie.initial_price = goalie.price  # Store the initial price for reference
    
    # Commit all changes to the database
    db.session.commit()
    print(f"✅ Player and goalie prices calculated and updated. Price range: ${MIN_PRICE/1000:.1f}K - ${MAX_PRICE/1000:.1f}K")

def populate_db():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        db.create_all()  # Create tables if they don't exist
        teams = Team.query.all()
        if teams:
            print("Teams already populated, skipping team population.")
        else:
            print("No teams found, populating teams...")
            fetch_and_store_teams()
            print("Teams populated.")

        # Now fetch players for each team in our teams table.
        teams = Team.query.all()
        for team in teams:
            print(f"Fetching players for team: {team.abbr}")
            fetch_and_store_players_for_team(team.abbr)
        
        # Calculate prices for all players
        calculate_prices()

if __name__ == '__main__':
    # Create a Flask app context to run any database operations
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        # # Check if specific argument is provided
        # if len(sys.argv) > 1 and sys.argv[1] == "populate":
        #     populate_db()
        # else:
        #     # By default, just recalculate prices for existing players
        calculate_prices()
        # populate_db()
        # fetch_and_store_players_for_team("VGK")
