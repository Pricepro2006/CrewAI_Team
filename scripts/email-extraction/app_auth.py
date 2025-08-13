#!/usr/bin/env python
"""
Authentication utility for IEMS Microsoft Graph API
Gets and saves application token
"""

import requests
import json
import os
import time
from datetime import datetime

# Azure AD configuration - read from .env file
import os
from pathlib import Path

# Read from .env file
env_path = Path(__file__).parent.parent.parent / '.env'
env_vars = {}
if env_path.exists():
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key] = value.strip()

client_id = env_vars.get('MSGRAPH_CLIENT_ID', "23208ebe-80e9-429d-8a37-8fcaca70e43d")
client_secret = env_vars.get('MSGRAPH_CLIENT_SECRET', "Tet8Qcx5xDjhYc40vaXynqUSfG8gBuuhFMI_aMj")
tenant_id = env_vars.get('MSGRAPH_TENANT_ID', "7fe14ab6-8f5d-4139-84bf-cd8aed0ee6b9")
token_endpoint = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


def get_app_token():
    """Get application token using client credentials flow"""
    # Prepare the request data
    data = {
        "client_id": client_id,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": client_secret,
        "grant_type": "client_credentials"
    }

    # Make the request to get a token
    try:
        response = requests.post(token_endpoint, data=data)
        response_data = response.json()

        if "access_token" in response_data:
            # Calculate expiration time
            expires_in = response_data.get("expires_in", 3600)
            expires_on = int(time.time()) + expires_in

            # Save token to file
            token_data = {
                "access_token": response_data["access_token"],
                "token_type": response_data.get("token_type", "Bearer"),
                "expires_on": expires_on,
                "created_at": datetime.now().isoformat()
            }

            with open("app_token.json", "w") as f:
                json.dump(token_data, f, indent=2)

            print("\nAuthentication successful!")
            print(f"Token saved to app_token.json")
            print(
                f"Token expires in {expires_in} seconds ({datetime.fromtimestamp(expires_on).strftime('%Y-%m-%d %H:%M:%S')})")
            print(f"Token type: {response_data.get('token_type', 'Bearer')}")
            print(f"Token preview: {response_data['access_token'][:15]}...")

            return response_data["access_token"]
        else:
            print(f"\nError retrieving token:")
            print(json.dumps(response_data, indent=2))
            return None
    except Exception as e:
        print(f"\nException during authentication: {str(e)}")
        return None


if __name__ == "__main__":
    print("=== IEMS Microsoft Graph Authentication ===")
    print("Getting application token for IEMS...")
    token = get_app_token()

    if token:
        print("\nYou can now use the IEMS tools with Microsoft Graph API")
    else:
        print("\nFailed to get application token. Please check your configuration.")
