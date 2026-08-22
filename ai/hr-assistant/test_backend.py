from backend_client import DayflowClient


token = input("Paste your access token: ").strip()

client = DayflowClient(token)

try:
    profile = client.get_profile()

    print("\nBackend connection successful!")
    print("Profile response:")
    print(profile)

except Exception as error:
    print("\nBackend connection failed:")
    print(error)