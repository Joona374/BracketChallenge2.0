from db import db_engine as db
from datetime import datetime, UTC
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    team_name = db.Column(db.String(80), nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    registration_code = db.Column(db.String(80), db.ForeignKey('registration_codes.code'), nullable=False)
    has_voted = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)

    # Cloudinary logo URLs
    logo1_url = db.Column(db.String(255))
    logo2_url = db.Column(db.String(255))
    logo3_url = db.Column(db.String(255))
    logo4_url = db.Column(db.String(255))

    # Currently selected logo (default is placeholder)
    selected_logo_url = db.Column(
        db.String(255),
        default="https://res.cloudinary.com/dqwx4hrsc/image/upload/v1744055077/no_logo_v6li8y.png"
    )

    picks = db.relationship("Pick", back_populates="user", uselist=True)
    vote = db.relationship("Vote", back_populates="user", uselist=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'
    
class RegistrationCode(db.Model):
    __tablename__ = 'registration_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(80), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    is_used = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f'<RegistrationCode {self.code} - Used: {self.is_used}>'
    

class Matchup(db.Model):
    __tablename__ = 'matchups'

    id = db.Column(db.Integer, primary_key=True)
    round = db.Column(db.Integer, nullable=False)
    conference = db.Column(db.String(80), nullable=False)
    matchup_code = db.Column(db.String(80), unique=True, nullable=False)
    team1 = db.Column(db.String(80), nullable=False)
    team2 = db.Column(db.String(80), nullable=False)

class Pick(db.Model):
    __tablename__ = 'picks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    picks_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))

    user = db.relationship('User', back_populates="picks")


class LineupPick(db.Model):
    __tablename__ = 'lineup_picks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lineup_json = db.Column(db.Text, nullable=False)  # JSON format of selected players
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))

    user = db.relationship("User", backref="lineup_pick", uselist=False)

class Prediction(db.Model):
    __tablename__ = 'predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    predictions_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False)
    
    user = db.relationship('User', backref=db.backref('predictions', lazy=True))
    
    def __repr__(self):
        return f'<Prediction {self.id} by User {self.user_id}>'

class Team(db.Model):
    __tablename__ = 'teams'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    abbr = db.Column(db.String(10), nullable=False, unique=True)
    logo_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    
    def __repr__(self):
        return f'<Team {self.name} ({self.abbr})>'

class Player(db.Model):
    __tablename__ = 'players'
    id = db.Column(db.Integer, primary_key=True)
    api_id = db.Column(db.Integer, unique=True, nullable=False)  # NHL API playerId
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    team_abbr = db.Column(db.String(10), db.ForeignKey('teams.abbr'), nullable=False)
    position = db.Column(db.String(2), nullable=False)  # e.g. L, C, R, D, G
    jersey_number = db.Column(db.String(10), nullable=True)
    birth_country = db.Column(db.String(10), nullable=True)
    birth_year = db.Column(db.Integer, nullable=True)
    headshot = db.Column(db.String(255), nullable=True)
    is_U23 = db.Column(db.Boolean, default=False)
    price = db.Column(db.Integer, default=1)
    
    # Regular season stats
    reg_gp = db.Column(db.Integer, default=0)
    reg_goals = db.Column(db.Integer, default=0)
    reg_assists = db.Column(db.Integer, default=0)
    reg_points = db.Column(db.Integer, default=0)
    reg_plus_minus = db.Column(db.Integer, default=0)
    
    # Playoff stats (set as placeholders until available)
    playoff_goals = db.Column(db.Integer, default=0)
    playoff_assists = db.Column(db.Integer, default=0)
    playoff_points = db.Column(db.Integer, default=0)
    playoff_plus_minus = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    
    def __repr__(self):
        return f'<Player {self.first_name} {self.last_name} ({self.team_abbr})>'

class Vote(db.Model):
    __tablename__ = 'votes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    entry_fee = db.Column(db.Integer, nullable=False)
    first_place_percentage = db.Column(db.Integer, nullable=False)
    second_place_percentage = db.Column(db.Integer, nullable=False)
    third_place_percentage = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    
    user = db.relationship("User", back_populates="vote")

    def __repr__(self):
        return f'<Vote by {self.user.username}: {self.entry_fee}€, {self.first_place_percentage}%/{self.second_place_percentage}%/{self.third_place_percentage}%>'