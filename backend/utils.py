import random
from datetime import datetime, UTC
from flask import Flask

from config import Config
from db import db_engine as db
from models import RegistrationCode, Matchup, Player

def generate_random_code():
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    code = ""
    for _ in range(4):
        code += random.choice(chars)
    code += "-"
    for _ in range(4):
        code += random.choice(chars)
    
    return code

def create_registration_codes(ammount: int):
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        for _ in range(ammount):
            code = generate_random_code()
            new_code = RegistrationCode(code=code, created_at=datetime.now(UTC), is_used=False)
            db.session.add(new_code)
            print(f"Code {code} added to the database.")

        db.session.commit()
        print(f"{ammount} codes added to the database.")

def create_matchups():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    with app.app_context():
        if Matchup.query.count() == 0:
            matchups = [
                Matchup(round=1, conference='west', matchup_code='C1vsWC2', team1='DAL', team2='VGK'),
                Matchup(round=1, conference='west', matchup_code='C2vsC3', team1='WPG', team2='COL'),
                Matchup(round=1, conference='west', matchup_code='P1vsWC1', team1='VAN', team2='NSH'),
                Matchup(round=1, conference='west', matchup_code='P2vsP3', team1='EDM', team2='LAK'),
                Matchup(round=1, conference='east', matchup_code='A1vsWC1', team1='FLA', team2='TBL'),
                Matchup(round=1, conference='east', matchup_code='A2vsA3', team1='BOS', team2='TOR'),
                Matchup(round=1, conference='east', matchup_code='M1vsWC2', team1='NYR', team2='WSH'),
                Matchup(round=1, conference='east', matchup_code='M2vsM3', team1='CAR', team2='NYI'),
            ]

            db.session.add_all(matchups)
            db.session.commit()
            print("✅ Seeded Round 1 matchups.")


def add_mock_players():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    with app.app_context():
        if Player.query.count() == 0:
            mock_players = [
                Player(first_name='Saku', last_name='Koivula', team='MIN', position='L', is_rookie=False),
                Player(first_name='Ville', last_name='Pelto', team='TOR', position='C', is_rookie=True),
                Player(first_name='Teemu', last_name='Päijänne', team='EDM', position='D', is_rookie=False),
                Player(first_name='Ville', last_name='Korhonen', team='BOS', position='D', is_rookie=True),
                Player(first_name='Kari', last_name='Lehto', team='DAL', position='G', is_rookie=False),
                Player(first_name='Antti', last_name='Rask', team='NYR', position='L', is_rookie=False),
                Player(first_name='Mika', last_name='Kallio', team='WPG', position='D', is_rookie=False),
                Player(first_name='Jussi', last_name='Markka', team='COL', position='G', is_rookie=True),
                Player(first_name='Olli', last_name='Joki', team='VGK', position='R', is_rookie=False),
                Player(first_name='Mikko', last_name='Koivunen', team='LAK', position='R', is_rookie=True),
                Player(first_name='Joni', last_name='Kokko', team='NSH', position='C', is_rookie=False),
            ]
            
            db.session.bulk_save_objects(mock_players)
            db.session.commit()
            print("✅ Seeded mock players.")
        else:
            print("❌ Players already seeded.")

if __name__ == "__main__":
    add_mock_players()
