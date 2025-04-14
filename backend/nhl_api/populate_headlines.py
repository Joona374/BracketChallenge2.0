import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from datetime import datetime, timezone, timedelta
from config import Config
from db import db_engine as db
from models import Headline

def populate_headlines():
    """
    Populate the headlines table with sample data
    """
    print("Creating sample headlines...")
    
    # Clear existing headlines for testing purposes
    Headline.query.delete()
    
    # Sample global headlines (not specific to any team)
    global_headlines = [
        "🔥 Bracket Deadline: April 20 at 21:00 EET - Make your picks now!",
        "🧊 Eastern Conference matchups heating up as playoffs approach",
        "🚨 Only one week left to finalize your playoff bracket",
        "🏆 Who will hoist the Cup? Place your bets in the bracket challenge!",
        "😤 Don't sleep on the underdogs this playoff season",
        "🏒 First round matchups are set - How many upsets will we see?",
        "🥅 Goalies expected to be the difference makers this postseason",
        "⭐ Star players ready to shine on the playoff stage",
        "📊 Analytics suggest tight races in both conferences",
    ]
    
    # Team-specific headlines
    team_headlines = [
        {"team": "Boston Bruins", "headline": "🐻 Bruins secure home ice advantage for first round"},
        {"team": "Toronto Maple Leafs", "headline": "🍁 Maple Leafs looking to break first-round curse"},
        {"team": "Tampa Bay Lightning", "headline": "⚡ Lightning aim for third Stanley Cup in four years"},
        {"team": "Florida Panthers", "headline": "🐱 Panthers hungry for deep playoff run after last season's success"},
        {"team": "New York Rangers", "headline": "🗽 Rangers riding hot goaltending into playoffs"},
        {"team": "Colorado Avalanche", "headline": "❄️ Avalanche enter playoffs as Western Conference favorites"},
        {"team": "Edmonton Oilers", "headline": "🛢️ McDavid and Draisaitl lead Oilers' cup hopes"},
        {"team": "Vegas Golden Knights", "headline": "🎰 Defending champion Knights ready for repeat attempt"},
        {"team": "Dallas Stars", "headline": "⭐ Stars' defense could be key to playoff success"},
    ]
    
    # Create timestamps with some variation
    now = datetime.now(timezone.utc)
    
    # Add global headlines with varying timestamps
    for i, headline_text in enumerate(global_headlines):
        # Create headlines at various times over the past few days
        created_time = now - timedelta(hours=i*5)
        
        headline = Headline(
            headline=headline_text,
            team_name=None,  # Global headline
            created=created_time,
            is_active=True
        )
        db.session.add(headline)
        print(f"Added global headline: {headline_text}")
    
    # Add team-specific headlines
    for i, item in enumerate(team_headlines):
        # Create team headlines at various times over the past week
        created_time = now - timedelta(hours=i*8 + 12)
        
        headline = Headline(
            headline=item["headline"],
            team_name=item["team"],
            created=created_time,
            is_active=True
        )
        db.session.add(headline)
        print(f"Added team headline for {item['team']}: {item['headline']}")
    
    # Add a couple of inactive headlines for testing admin functionality
    inactive_headlines = [
        "❌ Old news that should be hidden now",
        "❌ Another outdated headline for testing"
    ]
    
    for i, headline_text in enumerate(inactive_headlines):
        created_time = now - timedelta(days=10 + i)
        
        headline = Headline(
            headline=headline_text,
            team_name=None,
            created=created_time,
            is_active=False  # Inactive
        )
        db.session.add(headline)
        print(f"Added inactive headline: {headline_text}")
    
    db.session.commit()
    print(f"✅ Added {len(global_headlines) + len(team_headlines) + len(inactive_headlines)} headlines to the database")

if __name__ == '__main__':
    # Create a Flask app context to run database operations
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        populate_headlines()