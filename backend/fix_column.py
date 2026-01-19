from sqlalchemy import create_engine, text
import os

engine = create_engine(os.environ.get("DATABASE_URL").replace("postgresql://", "postgresql+psycopg://"))
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash TYPE VARCHAR(256)"))
    conn.commit()
    print("Column updated!")
