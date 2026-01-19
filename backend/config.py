import os
from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Use DATABASE_URL from environment (Neon/Render), fallback to SQLite for local dev
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///" + os.path.join(basedir, "nhl_bracket.db"))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
