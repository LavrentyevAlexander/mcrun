import os
from dotenv import load_dotenv
import requests
from collections import defaultdict
from datetime import datetime, timedelta
from tabulate import tabulate
import time

load_dotenv()

CLIENT_ID = os.getenv('CLIENT_ID')
CLIENT_SECRET = os.getenv('CLIENT_SECRET')
REFRESH_TOKEN = os.getenv('REFRESH_TOKEN')

def get_access_token():
    response = requests.post(
        'https://www.strava.com/oauth/token',
        data={
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'grant_type': 'refresh_token',
            'refresh_token': REFRESH_TOKEN
        }
    )
    response.raise_for_status()
    return response.json()['access_token']

def get_activities(access_token, after_date=None):
    headers = {'Authorization': f'Bearer {access_token}'}
    after_timestamp = 0 if after_date is None else int(datetime.strptime(after_date, "%Y-%m-%d").timestamp())

    activities = []
    page = 1

    while True:
        print("Ask for data from page", page)
        response = requests.get(
            'https://www.strava.com/api/v3/athlete/activities',
            headers=headers,
            params={
                'after': after_timestamp,
                'per_page': 100,
                'page': page
            }
        )
        response.raise_for_status()
        data = response.json()
        print(f"Got {len(data)} records with page={page}")
        if not data:
            break
        activities.extend(data)
        time.sleep(1)
        page += 1

    return activities

if __name__ == '__main__':
    token = get_access_token()
    after_date = input("Enter start date (YYYY-MM-DD) or leave it empty for all data: ").strip()
    after_date = after_date if after_date else None
    activities = get_activities(token, after_date=after_date)

    gear_names = {}
    gear_km = defaultdict(float)

    rows = []
    # total_km = 0

    for act in activities:
        gear_id = act.get('gear_id')
        if not gear_id:
            continue
        if gear_id not in gear_names:
            gear_resp = requests.get(f'https://www.strava.com/api/v3/gear/{gear_id}', headers={'Authorization': f'Bearer {token}'})
            if gear_resp.status_code == 200:
                gear_names[gear_id] = gear_resp.json().get('name', gear_id)
            else:
                gear_names[gear_id] = gear_id

        if act['type'] != 'Run' or not gear_id:
            continue

        date = act['start_date_local'][:10]
        name = act['name']
        distance_km = act['distance'] / 1000
        duration_min = act['moving_time'] // 60
        # total_km += distance_km
        gear_km[gear_names[gear_id]] += distance_km
        row = [date, name, f"{distance_km:.2f}", duration_min]
        rows.append(row)

    print(tabulate(rows, headers=["Data", "Name", "Km", "Min"], tablefmt="grid"))
    print("\nKilometers by gear:")
    for gear, km in gear_km.items():
        print(f"{gear}: {km:.2f} km")