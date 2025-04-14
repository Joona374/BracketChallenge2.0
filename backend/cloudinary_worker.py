import os
import cloudinary
import cloudinary.uploader
from models import User
from db import db_engine as db
from flask import Flask
from config import Config
from dotenv import load_dotenv
import base64

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

def upload_image_data(image_data, folder="nhl_bracket_logos"):
    """
    Upload image data directly to Cloudinary
    
    Args:
        image_data (str): Base64-encoded image data
        folder (str): Cloudinary folder to upload to
    
    Returns:
        str: Cloudinary URL if successful, None otherwise
    """
    try:
        # Upload the image to Cloudinary, explicitly telling it this is base64 data
        result = cloudinary.uploader.upload(
            f"data:image/png;base64,{image_data}",  # Properly format as data URL
            folder=folder
        )
        
        # Return the secure URL of the uploaded image
        return result.get("secure_url")
    except Exception as e:
        print(f"Error uploading image to Cloudinary: {e}")
        return None

def upload_file_for_user(user_id, file_data, position=None):
    """
    Upload a file to Cloudinary and assign the URL to the specified position
    for the user. If position is not specified, only return the URL.
    
    Args:
        user_id (int): User ID to assign the URL to
        file_data (str): Base64 encoded image data
        position (int, optional): Position of logo (1-4, or None)
    
    Returns:
        dict: Result with status and URL
    """
    try:
        # Upload the image
        url = upload_image_data(file_data)
        
        if not url:
            return {"success": False, "message": "Upload failed", "url": None}
        
        # If position is specified, update the user record
        if position and user_id:
            app = Flask(__name__)
            app.config.from_object(Config)
            db.init_app(app)
            
            with app.app_context():
                user = User.query.get(user_id)
                if not user:
                    return {"success": False, "message": f"No user found with ID {user_id}", "url": url}
                
                # Update the appropriate logo URL based on position
                if position == 1:
                    user.logo1_url = url
                elif position == 2:
                    user.logo2_url = url
                elif position == 3:
                    user.logo3_url = url
                elif position == 4:
                    user.logo4_url = url
                elif position == 0:  # For selected logo
                    user.selected_logo_url = url
                
                db.session.commit()
        
        return {"success": True, "message": "Upload successful", "url": url}
    except Exception as e:
        print(f"Error in upload_file_for_user: {e}")
        return {"success": False, "message": str(e), "url": None}

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