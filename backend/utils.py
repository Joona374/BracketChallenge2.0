import random
from datetime import datetime, timezone
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
            new_code = RegistrationCode(code=code, created_at=datetime.now(timezone.utc), is_used=False)
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
                # West Conference (using W1, W2, W3, W4)
                Matchup(round=1, conference='west', matchup_code='W1', team1='DAL', team2='VGK'),
                Matchup(round=1, conference='west', matchup_code='W2', team1='WPG', team2='COL'),
                Matchup(round=1, conference='west', matchup_code='W3', team1='VAN', team2='NSH'),
                Matchup(round=1, conference='west', matchup_code='W4', team1='EDM', team2='LAK'),
                
                # East Conference (using E1, E2, E3, E4)
                Matchup(round=1, conference='east', matchup_code='E1', team1='FLA', team2='TBL'),
                Matchup(round=1, conference='east', matchup_code='E2', team1='BOS', team2='TOR'),
                Matchup(round=1, conference='east', matchup_code='E3', team1='NYR', team2='WSH'),
                Matchup(round=1, conference='east', matchup_code='E4', team1='CAR', team2='NYI'),
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
            # Valid teams from matchups: DAL, VGK, WPG, COL, VAN, NSH, EDM, LAK, FLA, TBL, BOS, TOR, NYR, WSH, CAR, NYI
            mock_players = [
                # Existing players
                Player(first_name='Saku', last_name='Koivula', team='VAN', position='L', is_U23=False, price=250000),
                Player(first_name='Ville', last_name='Pelto', team='TOR', position='C', is_U23=True, price=300000),
                Player(first_name='Teemu', last_name='Päijänne', team='EDM', position='D', is_U23=False, price=200000),
                Player(first_name='Ville', last_name='Korhonen', team='BOS', position='D', is_U23=True, price=150000),
                Player(first_name='Kari', last_name='Lehto', team='DAL', position='G', is_U23=False, price=175000),
                Player(first_name='Antti', last_name='Rask', team='NYR', position='L', is_U23=False, price=220000),
                Player(first_name='Mika', last_name='Kallio', team='WPG', position='D', is_U23=False, price=320000),
                Player(first_name='Jussi', last_name='Markka', team='COL', position='G', is_U23=True, price=112000),
                Player(first_name='Olli', last_name='Joki', team='VGK', position='R', is_U23=False, price=331000),
                Player(first_name='Mikko', last_name='Koivunen', team='LAK', position='R', is_U23=True, price=215000),
                Player(first_name='Joni', last_name='Kokko', team='NSH', position='C', is_U23=False, price=210000),
                
                # Additional players for each team
                # Dallas Stars (DAL)
                Player(first_name='Jason', last_name='Robertson', team='DAL', position='L', is_U23=False, price=475000),
                Player(first_name='Roope', last_name='Hintz', team='DAL', position='C', is_U23=False, price=455000),
                Player(first_name='Miro', last_name='Heiskanen', team='DAL', position='D', is_U23=False, price=465000),
                Player(first_name='Jake', last_name='Oettinger', team='DAL', position='G', is_U23=False, price=450000),

                # Vegas Golden Knights (VGK)
                Player(first_name='Jack', last_name='Eichel', team='VGK', position='C', is_U23=False, price=480000),
                Player(first_name='Mark', last_name='Stone', team='VGK', position='R', is_U23=False, price=460000),
                Player(first_name='Shea', last_name='Theodore', team='VGK', position='D', is_U23=False, price=440000),
                Player(first_name='Adin', last_name='Hill', team='VGK', position='G', is_U23=False, price=420000),

                # Winnipeg Jets (WPG)
                Player(first_name='Kyle', last_name='Connor', team='WPG', position='L', is_U23=False, price=470000),
                Player(first_name='Mark', last_name='Scheifele', team='WPG', position='C', is_U23=False, price=465000),
                Player(first_name='Josh', last_name='Morrissey', team='WPG', position='D', is_U23=False, price=450000),
                Player(first_name='Connor', last_name='Hellebuyck', team='WPG', position='G', is_U23=False, price=490000),

                # Colorado Avalanche (COL)
                Player(first_name='Nathan', last_name='MacKinnon', team='COL', position='C', is_U23=False, price=495000),
                Player(first_name='Mikko', last_name='Rantanen', team='COL', position='R', is_U23=False, price=485000),
                Player(first_name='Cale', last_name='Makar', team='COL', position='D', is_U23=False, price=490000),
                Player(first_name='Alexandar', last_name='Georgiev', team='COL', position='G', is_U23=False, price=440000),

                # Vancouver Canucks (VAN)
                Player(first_name='Elias', last_name='Pettersson', team='VAN', position='C', is_U23=False, price=460000),
                Player(first_name='Quinn', last_name='Hughes', team='VAN', position='D', is_U23=False, price=470000),
                Player(first_name='J.T.', last_name='Miller', team='VAN', position='L', is_U23=False, price=450000),
                Player(first_name='Thatcher', last_name='Demko', team='VAN', position='G', is_U23=False, price=455000),

                # Nashville Predators (NSH)
                Player(first_name='Filip', last_name='Forsberg', team='NSH', position='L', is_U23=False, price=460000),
                Player(first_name='Roman', last_name='Josi', team='NSH', position='D', is_U23=False, price=475000),
                Player(first_name='Ryan', last_name='O`Reilly', team='NSH', position='C', is_U23=False, price=445000),
                Player(first_name='Juuse', last_name='Saros', team='NSH', position='G', is_U23=False, price=455000),

                # Edmonton Oilers (EDM)
                Player(first_name='Connor', last_name='McDavid', team='EDM', position='C', is_U23=False, price=500000),
                Player(first_name='Leon', last_name='Draisaitl', team='EDM', position='C', is_U23=False, price=490000),
                Player(first_name='Evan', last_name='Bouchard', team='EDM', position='D', is_U23=False, price=450000),
                Player(first_name='Stuart', last_name='Skinner', team='EDM', position='G', is_U23=False, price=420000),

                # Los Angeles Kings (LAK)
                Player(first_name='Anze', last_name='Kopitar', team='LAK', position='C', is_U23=False, price=450000),
                Player(first_name='Kevin', last_name='Fiala', team='LAK', position='L', is_U23=False, price=435000),
                Player(first_name='Drew', last_name='Doughty', team='LAK', position='D', is_U23=False, price=445000),
                Player(first_name='Cam', last_name='Talbot', team='LAK', position='G', is_U23=False, price=420000),

                # Florida Panthers (FLA)
                Player(first_name='Aleksander', last_name='Barkov', team='FLA', position='C', is_U23=False, price=485000),
                Player(first_name='Matthew', last_name='Tkachuk', team='FLA', position='L', is_U23=False, price=480000),
                Player(first_name='Gustav', last_name='Forsling', team='FLA', position='D', is_U23=False, price=450000),
                Player(first_name='Sergei', last_name='Bobrovsky', team='FLA', position='G', is_U23=False, price=470000),

                # Tampa Bay Lightning (TBL)
                Player(first_name='Nikita', last_name='Kucherov', team='TBL', position='R', is_U23=False, price=495000),
                Player(first_name='Brayden', last_name='Point', team='TBL', position='C', is_U23=False, price=470000),
                Player(first_name='Victor', last_name='Hedman', team='TBL', position='D', is_U23=False, price=480000),
                Player(first_name='Andrei', last_name='Vasilevskiy', team='TBL', position='G', is_U23=False, price=490000),

                # Boston Bruins (BOS)
                Player(first_name='David', last_name='Pastrnak', team='BOS', position='R', is_U23=False, price=485000),
                Player(first_name='Brad', last_name='Marchand', team='BOS', position='L', is_U23=False, price=465000),
                Player(first_name='Charlie', last_name='McAvoy', team='BOS', position='D', is_U23=False, price=460000),
                Player(first_name='Jeremy', last_name='Swayman', team='BOS', position='G', is_U23=False, price=450000),

                # Toronto Maple Leafs (TOR)
                Player(first_name='Auston', last_name='Matthews', team='TOR', position='C', is_U23=False, price=490000),
                Player(first_name='Mitch', last_name='Marner', team='TOR', position='R', is_U23=False, price=475000),
                Player(first_name='Morgan', last_name='Rielly', team='TOR', position='D', is_U23=False, price=455000),
                Player(first_name='Joseph', last_name='Woll', team='TOR', position='G', is_U23=False, price=420000),

                # New York Rangers (NYR)
                Player(first_name='Artemi', last_name='Panarin', team='NYR', position='L', is_U23=False, price=485000),
                Player(first_name='Mika', last_name='Zibanejad', team='NYR', position='C', is_U23=False, price=470000),
                Player(first_name='Adam', last_name='Fox', team='NYR', position='D', is_U23=False, price=475000),
                Player(first_name='Igor', last_name='Shesterkin', team='NYR', position='G', is_U23=False, price=485000),

                # Washington Capitals (WSH)
                Player(first_name='Alexander', last_name='Ovechkin', team='WSH', position='L', is_U23=False, price=480000),
                Player(first_name='Dylan', last_name='Strome', team='WSH', position='C', is_U23=False, price=435000),
                Player(first_name='John', last_name='Carlson', team='WSH', position='D', is_U23=False, price=455000),
                Player(first_name='Charlie', last_name='Lindgren', team='WSH', position='G', is_U23=False, price=420000),

                # Carolina Hurricanes (CAR)
                Player(first_name='Sebastian', last_name='Aho', team='CAR', position='C', is_U23=False, price=475000),
                Player(first_name='Seth', last_name='Jarvis', team='CAR', position='R', is_U23=False, price=445000),
                Player(first_name='Jaccob', last_name='Slavin', team='CAR', position='D', is_U23=False, price=460000),
                Player(first_name='Frederik', last_name='Andersen', team='CAR', position='G', is_U23=False, price=455000),

                # New York Islanders (NYI)
                Player(first_name='Mathew', last_name='Barzal', team='NYI', position='C', is_U23=False, price=465000),
                Player(first_name='Bo', last_name='Horvat', team='NYI', position='C', is_U23=False, price=455000),
                Player(first_name='Noah', last_name='Dobson', team='NYI', position='D', is_U23=False, price=450000),
                Player(first_name='Ilya', last_name='Sorokin', team='NYI', position='G', is_U23=False, price=475000),
                
                # Add some U23s to different teams
                Player(first_name='Connor', last_name='Bedard', team='TOR', position='C', is_U23=True, price=400000),
                Player(first_name='Luke', last_name='Hughes', team='VAN', position='D', is_U23=True, price=380000),
                Player(first_name='Will', last_name='Smith', team='EDM', position='R', is_U23=True, price=365000),
                Player(first_name='Logan', last_name='Cooley', team='NYR', position='C', is_U23=True, price=370000),
                Player(first_name='Adam', last_name='Fantilli', team='FLA', position='C', is_U23=True, price=375000),
                Player(first_name='Leo', last_name='Carlsson', team='LAK', position='C', is_U23=True, price=360000),
                Player(first_name='Matvei', last_name='Michkov', team='WSH', position='R', is_U23=True, price=390000),
                Player(first_name='Devon', last_name='Levi', team='BOS', position='G', is_U23=True, price=340000)
            ]
            
            db.session.bulk_save_objects(mock_players)
            db.session.commit()
            print("✅ Seeded mock players.")
        else:
            print("❌ Players already seeded.")

if __name__ == "__main__":
    # create_matchups()
    # add_mock_players()
    pass