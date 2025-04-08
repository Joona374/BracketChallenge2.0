import os
import cloudinary
import cloudinary.uploader
from models import User
from db import db_engine as db
from flask import Flask
from config import Config
from dotenv import load_dotenv

load_dotenv()

cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
print(cloud_name)
api_key = os.getenv("CLOUDINARY_API_KEY")
print(api_key)
api_secret = os.getenv("CLOUDINARY_API_SECRET")
print(api_secret)


# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

def upload_logos_for_user(user_id, filenames):
    """
    Upload 4 logos from local folder and assign to a user in the DB.
    """
    if len(filenames) != 4:
        print("❌ Please provide exactly 4 logo filenames.")
        return

    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        user = User.query.get(user_id)
        if not user:
            print(f"❌ No user found with ID {user_id}")
            return

        urls = []
        for i, filename in enumerate(filenames):
            path = os.path.join("team_logos", filename)
            if not os.path.exists(path):
                print(f"❌ File not found: {path}")
                return

            print(f"📤 Uploading {filename}...")
            result = cloudinary.uploader.upload(path, folder="nhl_bracket_logos")
            url = result.get("secure_url")
            if not url:
                print(f"❌ Upload failed for {filename}")
                return
            urls.append(url)

        user.logo1_url = urls[0]
        user.logo2_url = urls[1]
        user.logo3_url = urls[2]
        user.logo4_url = urls[3]

        db.session.commit()
        print(f"✅ Logos uploaded and assigned to user {user.username}")


def assign_cdn_urls_to_user(user_id, urls):
    """
    Assign 4 pre-uploaded Cloudinary URLs to a user in the DB.
    
    Args:
        user_id (int): The ID of the user to assign the URLs to
        urls (list): A list of 4 Cloudinary URLs
    """
    if len(urls) != 4:
        print("❌ Please provide exactly 4 logo URLs.")
        return

    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        user = User.query.get(user_id)
        if not user:
            print(f"❌ No user found with ID {user_id}")
            return

        user.logo1_url = urls[0]
        user.logo2_url = urls[1]
        user.logo3_url = urls[2]
        user.logo4_url = urls[3]

        db.session.commit()
        print(f"✅ Logo URLs assigned to user {user.username}")


if __name__ == "__main__":
    # upload_logos_for_user(
    # user_id=1,
    # filenames=[
    #     "urho1.png",
    #     "urho2.png",
    #     "urho3.png",
    #     "urho4.png"
    # ]
    # )
    assign_cdn_urls_to_user(
        user_id=4,
        urls=[
            "https://res.cloudinary.com/dqwx4hrsc/image/upload/v1744055077/no_logo_v6li8y.png",
            "https://res.cloudinary.com/dqwx4hrsc/image/upload/v1744046029/nhl_bracket_logos/d9tlhq6qm90rdrf6macf.png",
            "https://res.cloudinary.com/dqwx4hrsc/image/upload/v1744022575/logo_cyjav5.png",
            "https://res.cloudinary.com/dqwx4hrsc/image/upload/v1744046022/nhl_bracket_logos/mgtn2l6zbpw2rpyia6vt.png"
        ]
    )