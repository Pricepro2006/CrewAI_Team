#!/usr/bin/env python3
"""
Fixed Device Authentication for Microsoft Graph API

This script provides a simplified authentication flow for Microsoft Graph API
using the device code flow with properly formatted scopes.
"""
import os
import sys
import json
import time
import requests
from datetime import datetime, timedelta

# Configure simple logging
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('fixed_device_auth')

def load_config():
    """Load configuration from graph_config.json"""
    try:
        config_path = os.path.join(os.path.dirname(__file__), "graph_config.json")
        if not os.path.exists(config_path):
            print(f"Error: Configuration file not found at {config_path}")
            return None
            
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Validate required fields
        client_id = config.get("client_id")
        tenant_id = config.get("tenant_id")
        
        if not client_id:
            print("Error: Missing client_id in graph_config.json")
            return None
            
        if not tenant_id:
            print("Error: Missing tenant_id in graph_config.json")
            return None
        
        return config
    except Exception as e:
        print(f"Error loading configuration: {e}")
        return None

def get_device_code(client_id, tenant_id):
    """Get device code from Microsoft's OAuth endpoint"""
    device_code_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/devicecode"
    
    # Using the proper scope format for Graph API with separate offline_access
    scope = "https://graph.microsoft.com/.default"
    # Add standard OAuth scopes separately
    scope += " offline_access"
    
    data = {
        "client_id": client_id,
        "scope": scope
    }
    
    response = requests.post(device_code_url, data=data)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error getting device code: {response.status_code}")
        print(response.text)
        return None

def poll_for_token(client_id, tenant_id, device_code):
    """Poll for token using the device code"""
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    
    data = {
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        "client_id": client_id,
        "device_code": device_code
    }
    
    # Poll for token (default max 15 minutes)
    max_time = time.time() + 15 * 60
    interval = 5  # Start with 5 seconds interval
    
    print("Waiting for authentication...")
    
    while time.time() < max_time:
        response = requests.post(token_url, data=data)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 400:
            error = response.json().get("error")
            
            if error == "authorization_pending":
                # Still waiting for user to authenticate
                print(".", end="", flush=True)
                time.sleep(interval)
                continue
            elif error == "authorization_declined":
                print("\nAuthorization declined by user")
                return None
            elif error == "expired_token":
                print("\nDevice code expired")
                return None
            else:
                print(f"\nError: {error}")
                print(response.text)
                return None
        else:
            print(f"\nUnexpected error: {response.status_code}")
            print(response.text)
            return None
    
    print("\nAuthentication timed out")
    return None

def test_token(access_token):
    """Test the token with Microsoft Graph API"""
    print("\n\nTesting token with Microsoft Graph API...")
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json"
    }
    
    # Test /me endpoint
    me_url = "https://graph.microsoft.com/v1.0/me"
    me_response = requests.get(me_url, headers=headers)
    
    if me_response.status_code == 200:
        me_data = me_response.json()
        print(f"Success! Authenticated as: {me_data.get('displayName', 'Unknown')}")
        return True
    else:
        print(f"Error accessing /me endpoint: {me_response.status_code}")
        print(me_response.text)
        return False

def main():
    """Main function"""
    print("=== Fixed Device Authentication for Microsoft Graph API ===\n")
    
    # Load configuration
    config = load_config()
    if not config:
        print("Failed to load configuration")
        return 1
    
    client_id = config["client_id"]
    tenant_id = config["tenant_id"]
    
    print(f"Using client ID: {client_id}")
    print(f"Using tenant ID: {tenant_id}")
    
    # Check for existing token
    if os.path.exists("access_token.json"):
        try:
            with open("access_token.json", "r") as f:
                token_data = json.load(f)
            
            # Check if token is still valid
            if "expires_on" in token_data:
                expires_on = token_data["expires_on"]
                if time.time() < expires_on:
                    print("Using existing valid token")
                    if test_token(token_data["access_token"]):
                        return 0
                    print("Token is expired or invalid. Getting a new token...")
                else:
                    print("Token is expired. Getting a new token...")
            else:
                print("Token data is missing expiration. Getting a new token...")
        except Exception as e:
            print(f"Error with existing token: {e}")
            print("Getting a new token...")
    
    # Get device code
    device_code_response = get_device_code(client_id, tenant_id)
    if not device_code_response:
        print("Failed to get device code")
        return 1
    
    # Display authentication instructions
    user_code = device_code_response["user_code"]
    verification_uri = device_code_response["verification_uri"]
    
    print("\n=== To authenticate, follow these steps: ===")
    print(f"1. Go to: {verification_uri}")
    print(f"2. Enter code: {user_code}")
    print("3. Sign in with your Microsoft account")
    
    # Poll for token
    token_data = poll_for_token(client_id, tenant_id, device_code_response["device_code"])
    if not token_data:
        print("Failed to acquire token")
        return 1
    
    # Add expires_on for easier validity checking
    if "expires_in" in token_data:
        token_data["expires_on"] = time.time() + token_data["expires_in"]
    
    # Save token
    with open("access_token.json", "w") as f:
        json.dump(token_data, f, indent=2)
    print("\nToken saved to access_token.json")
    
    # Test token
    access_token = token_data["access_token"]
    if not test_token(access_token):
        print("Token test failed")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())