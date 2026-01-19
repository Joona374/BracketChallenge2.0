import os
from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Use DATABASE_URL from environment (Neon/Render), fallback to SQLite for local dev
    database_url = os.environ.get("DATABASE_URL", "sqlite:///" + os.path.join(basedir, "nhl_bracket.db"))
    
    # Convert postgres:// to postgresql+psycopg:// for psycopg3 driver
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
