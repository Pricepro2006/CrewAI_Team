#!/usr/bin/env python3
"""
Simple Device Code Authentication for Microsoft Graph API
Uses only requests library - no MSAL required
"""

import requests
import json
import time
import sys
import os
from datetime import datetime

# Load configuration
config_path = os.path.join(os.path.dirname(__file__), "graph_config.json")
with open(config_path, 'r') as f:
    config = json.load(f)

client_id = config['client_id']
tenant_id = config['tenant_id']

print("=== Simple Device Code Authentication ===\n")

# Step 1: Request device code
device_code_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/devicecode"
device_code_data = {
    'client_id': client_id,
    'scope': 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Read.Shared https://graph.microsoft.com/User.Read offline_access'
}

print("Requesting device code...")
response = requests.post(device_code_url, data=device_code_data)

if response.status_code != 200:
    print(f"Failed to get device code: {response.status_code}")
    print(response.text)
    sys.exit(1)

device_code_response = response.json()
device_code = device_code_response['device_code']
user_code = device_code_response['user_code']
verification_uri = device_code_response['verification_uri']
expires_in = device_code_response['expires_in']
interval = device_code_response.get('interval', 5)

print("\n=== To authenticate, follow these steps: ===")
print(f"1. Go to: {verification_uri}")
print(f"2. Enter code: {user_code}")
print("3. Sign in with your Microsoft account")
print("\nWaiting for authentication...")

# Step 2: Poll for token
token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
start_time = time.time()

while (time.time() - start_time) < expires_in:
    token_data = {
        'grant_type': 'urn:ietf:params:oauth:grant-type:device_code',
        'client_id': client_id,
        'device_code': device_code
    }
    
    token_response = requests.post(token_url, data=token_data)
    
    if token_response.status_code == 200:
        # Success!
        token_info = token_response.json()
        
        # Add expiration timestamp
        token_info['expires_on'] = time.time() + token_info.get('expires_in', 3600)
        
        # Save token
        with open('access_token.json', 'w') as f:
            json.dump(token_info, f, indent=2)
        
        print("\n✅ Authentication successful!")
        print(f"Token saved to: access_token.json")
        print(f"Token expires in: {token_info.get('expires_in', 3600)} seconds")
        
        # Test the token
        headers = {'Authorization': f"Bearer {token_info['access_token']}"}
        test_response = requests.get('https://graph.microsoft.com/v1.0/me', headers=headers)
        
        if test_response.status_code == 200:
            user_info = test_response.json()
            print(f"\nAuthenticated as: {user_info.get('displayName', 'Unknown')}")
            print(f"Email: {user_info.get('mail', user_info.get('userPrincipalName', 'Unknown'))}")
        
        break
    else:
        error_data = token_response.json()
        error = error_data.get('error', '')
        
        if error == 'authorization_pending':
            # Still waiting for user
            print(".", end="", flush=True)
            time.sleep(interval)
        elif error == 'slow_down':
            # Need to slow down polling
            interval += 5
            time.sleep(interval)
        else:
            # Other error
            print(f"\nError: {error}")
            print(f"Description: {error_data.get('error_description', 'Unknown')}")
            sys.exit(1)
else:
    print("\n❌ Authentication timed out")
    sys.exit(1)