from flask import Flask
from config import Config
from db import db_engine as db
from models import User, RegistrationCode

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

@app.route('/')
def home():
    return "Welcome to the NHL Bracket App!"


if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Create database tables if they don't exist
    app.run(debug=True)