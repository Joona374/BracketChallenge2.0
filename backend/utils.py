import random
from datetime import datetime, UTC
from flask import Flask

from config import Config
from db import db_engine as db
from models import RegistrationCode

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

if __name__ == "__main__":
    create_registration_codes(10)
