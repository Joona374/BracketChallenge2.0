import requests

# teams_response = requests.get("https://api-web.nhle.com/v1/standings/now")
# teams_data = teams_response.json()
# for team in teams_data["standings"]:
#     print(team["teamName"]["default"])
#     print(team["teamAbbrev"]["default"])
#     print(team["teamLogo"])

#     print("\n\n\n\n")

abbrev = "NYR"
roster_response = requests.get(f'https://api-web.nhle.com/v1/roster/{abbrev}/current')
roster_data = roster_response.json()
players = (roster_data.get("forwards", []) +
           roster_data.get("defensemen", []) +
           roster_data.get("goalies", []))

# all_players = []
# all_players.extend(players)
# for player in all_players:
#     player_id = player['id']
#     first_name = player['firstName']['default']
#     last_name = player['lastName']['default']
#     position = player['positionCode']
#     jersey_number = player['sweaterNumber']
#     birth_country = player['birthCountry']
#     birth_data = player["birthDate"]
#     birth_year = birth_data.split("-")[0]
#     headshot = player['headshot']
#     print(f"ID: {player_id}, Name: {first_name} {last_name}, Position: {position}, Jersey: {jersey_number}, Country: {birth_country}, Birth year: {birth_year}, Headshot: {headshot}")


# # 8477979
# player_response = requests.get(f"https://api-web.nhle.com/v1/player/8478402/landing")
# player_data = player_response.json()
# print(player_data)


import requests
import time

abbrev = "NYR"
roster_url = f'https://api-web.nhle.com/v1/roster/{abbrev}/current'
roster_response = requests.get(roster_url)
roster_data = roster_response.json()

players = (
    roster_data.get("forwards", []) +
    roster_data.get("defensemen", []) +
    roster_data.get("goalies", [])
)

print(f"\n📋 NYR Roster: {len(players)} players\n")

# Print header
header = f"{'Name':<25} {'Pos':<3} {'GP':>3} {'G':>3} {'A':>3} {'P':>3} {'+/-':>4}"
print(header)
print("-" * len(header))

for player in players:
    player_id = player['id']
    first_name = player['firstName']['default']
    last_name = player['lastName']['default']
    full_name = f"{first_name} {last_name}"
    position = player['positionCode']

    # Get player stats via landing endpoint
    url = f"https://api-web.nhle.com/v1/player/{player_id}/landing"
    response = requests.get(url)
    if response.status_code != 200:
        print(f"❌ Failed to fetch data for {full_name}")
        continue

    stats = response.json().get("featuredStats", {}).get("regularSeason", {}).get("subSeason", {})

    gp = stats.get("gamesPlayed", 0)
    goals = stats.get("goals", 0)
    assists = stats.get("assists", 0)
    points = stats.get("points", 0)
    plus_minus = stats.get("plusMinus", 0)


    print(f"{full_name:<25} {position:<3} {gp:>3} {goals:>3} {assists:>3} {points:>3} {plus_minus:>4}")

    time.sleep(0.1)  # Be kind to the API — small delay
