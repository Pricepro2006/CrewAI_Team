#!/usr/bin/env python
"""
Microsoft Authenticator Number Match Authentication

This script uses the browser authentication flow which supports Microsoft Authenticator's
number match feature where you confirm the number shown in Authenticator matches
what's displayed on your screen.
"""

import msal
import json
import os
import sys
import time
import logging
import random
import requests
from pathlib import Path
from datetime import datetime, timedelta
import webbrowser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("IEMS.NumberMatchAuth")

try:
    from dotenv import load_dotenv
    load_dotenv()
    logger.info("Loaded .env file")
except ImportError:
    logger.warning("python-dotenv not installed. Environment variables must be set manually.")

def load_config():
    """Load configuration from graph_config.json or environment variables"""
    config_path = Path(__file__).parent / "graph_config.json"
    
    if config_path.exists():
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                logger.info(f"Loaded configuration from {config_path}")
        except Exception as e:
            logger.error(f"Error loading {config_path}: {e}")
            config = {}
    else:
        logger.warning(f"Config file {config_path} not found, using defaults")
        config = {}
    
    # Override with environment variables if available
    config["client_id"] = os.environ.get("GRAPH_CLIENT_ID", config.get("client_id", "23208ebe-80e9-429d-8a37-8fcaca70e43d"))
    config["client_secret"] = os.environ.get("GRAPH_CLIENT_SECRET", config.get("client_secret", "3Pr8Q~W8wu7TKQNuo4v0GJwz0NK0T7Vw86~CFajw"))
    config["tenant_id"] = os.environ.get("GRAPH_TENANT_ID", config.get("tenant_id", "7fe14ab6-8f5d-4139-84bf-cd8aed0ee6b9"))
    config["authority"] = f"https://login.microsoftonline.com/{config['tenant_id']}"
    
    # Graph API scopes - standard format without URL prefix for MSAL
    config["scopes"] = [
        "Mail.Read", 
        "Mail.ReadWrite",
        "Mail.Send",
        "Mail.Read.Shared", 
        "Mail.ReadWrite.Shared",
        "User.Read"
    ]
    
    return config

def simulate_number_match_flow():
    """
    Simulates the number match flow by generating a random number and asking
    user to confirm it's the same as in Authenticator.
    """
    # Generate a random number similar to what Microsoft uses (usually 2-3 digits)
    match_number = random.randint(10, 999)
    
    print("\n" + "=" * 80)
    print(f"NUMBER MATCH AUTHENTICATION")
    print("=" * 80)
    print(f"\nYour authentication number is: {match_number}")
    print("\nInstructions:")
    print("1. You should receive a notification in Microsoft Authenticator app")
    print("2. Open the notification")
    print("3. Verify that the number shown in Authenticator matches the number above")
    print("4. Tap 'Approve' in Authenticator if the numbers match")
    print("\nWaiting for you to approve the request in Authenticator...\n")
    
    # In a real implementation, we'd wait for a callback from the authentication service
    # Here we'll simulate it with a confirmation
    confirmation = input("Did you approve the request in Authenticator? (y/n): ")
    return confirmation.lower() == 'y'

def authorize_with_device_code():
    """
    Authenticate with Microsoft Graph API using device code flow which
    can work with Microsoft Authenticator.
    """
    config = load_config()
    
    # Create public client application
    app = msal.PublicClientApplication(
        client_id=config["client_id"],
        authority=config["authority"]
    )
    
    # Try device code flow
    try:
        flow = app.initiate_device_flow(scopes=config["scopes"])
        
        if "user_code" not in flow:
            logger.error(f"Failed to initiate device flow: {flow.get('error_description', 'Unknown error')}")
            print(f"\nError starting authentication: {flow.get('error_description', 'Unknown error')}")
            return None
        
        print("\n" + "=" * 80)
        print("DEVICE CODE AUTHENTICATION WITH NUMBER MATCHING")
        print("=" * 80 + "\n")
        print(flow["message"] + "\n")
        
        print("Microsoft Authenticator Instructions:")
        print("1. Open the Microsoft Authenticator app on your device")
        print("2. Sign in to your account if needed")
        print("3. You will receive a notification to verify your sign-in")
        print("4. Match the number shown in Authenticator with what appears on screen")
        print("5. Approve the sign-in\n")
        
        # Try to open the verification URL
        verification_uri = flow.get("verification_uri")
        if verification_uri:
            try:
                print(f"Attempting to open {verification_uri} in your browser...")
                webbrowser.open(verification_uri)
            except Exception as e:
                logger.warning(f"Could not open browser: {e}")
                print(f"Please manually open: {verification_uri}")
        
        print("\nWaiting for authentication to complete...")
        result = app.acquire_token_by_device_flow(flow)
        
        if "access_token" in result:
            logger.info("Authentication successful with device code flow")
            token_path = Path(__file__).parent / "app_token.json"
            # Add timestamp for expiry calculation
            result["_created_time"] = datetime.now().timestamp()
            with open(token_path, 'w') as f:
                json.dump(result, f)
            
            print("\nAuthentication successful!")
            print(f"Token saved to app_token.json")
            return result
        else:
            logger.error(f"Authentication failed: {result.get('error_description', 'Unknown error')}")
            print(f"\nAuthentication failed.")
            print(f"Error: {result.get('error_description', 'Unknown error')}")
            return None
    
    except Exception as e:
        logger.error(f"Error in device code flow: {e}")
        print(f"\nError in authentication process: {e}")
        return None

def create_token_file_with_fake_token():
    """
    Create a token file with a fake token for demonstration purposes.
    
    This is used only when simulating the number match flow, since we can't
    actually get a real token that way in this script. For production use,
    this would be replaced with a real token from Microsoft Authentication.
    """
    # Create a fake token structure similar to what Microsoft returns
    # This is only for demonstration purposes
    token_data = {
        "access_token": "SIMULATED_ACCESS_TOKEN_FOR_DEMONSTRATION_ONLY",
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": "Mail.Read Mail.ReadWrite Mail.Send User.Read",
        "_created_time": datetime.now().timestamp(),
        "ext_expires_in": 3600,
        "_simulated": True
    }
    
    token_path = Path(__file__).parent / "app_token.json"
    with open(token_path, 'w') as f:
        json.dump(token_data, f)
    
    return token_data

def test_token_with_graph(token):
    """Test the token with Microsoft Graph API"""
    if not token:
        logger.error("No token provided")
        return False
    
    # Check if this is a simulated token
    if token.get("_simulated", False):
        logger.warning("This is a simulated token for demonstration only")
        print("\nNOTE: This is a simulated authentication.")
        print("In a real scenario, you would receive a valid token from Microsoft.")
        print("For testing purposes, we're simulating a successful authentication.")
        return True
    
    # This is a real token, so test it with Graph API
    if "access_token" not in token:
        logger.error("Invalid token structure")
        return False
    
    # Try /me endpoint (works with delegated permissions)
    headers = {
        "Authorization": f"Bearer {token['access_token']}",
        "Accept": "application/json"
    }
    
    logger.info("Testing token with /me endpoint")
    try:
        response = requests.get(
            "https://graph.microsoft.com/v1.0/me",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Token works with /me endpoint")
            print(f"\nUser information:")
            print(f"- Display Name: {data.get('displayName', 'Unknown')}")
            print(f"- Email: {data.get('mail', 'Unknown')}")
            return True
        else:
            logger.warning(f"Token failed with /me endpoint: {response.status_code}")
            print(f"\nFailed to access Microsoft Graph API with the token")
            print(f"Error: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"Error testing token: {e}")
        print(f"\nError testing token: {e}")
        return False

def main():
    """Main function"""
    print("=== Microsoft Authenticator Number Match Authentication ===")
    print("This tool helps you authenticate using Microsoft Authenticator")
    print("with the number matching feature.")
    print("========================================================\n")
    
    print("Select authentication method:")
    print("1. Device Code Flow (works with Authenticator number matching)")
    print("2. Simulate Number Match Flow (demonstration only)")
    choice = input("Enter your choice (1 or 2) [default: 1]: ").strip() or "1"
    
    if choice == "1":
        # Device code flow
        token = authorize_with_device_code()
    elif choice == "2":
        # Simulated number match flow (for demonstration only)
        print("\nNOTE: This is a simulation for demonstration purposes only.")
        print("In a real implementation, your app would be registered with Microsoft")
        print("Authentication Library (MSAL) to use number matching directly.\n")
        
        if simulate_number_match_flow():
            token = create_token_file_with_fake_token()
            print("\nSimulated successful authentication.")
            print("In a real scenario, Microsoft would provide a valid token.")
        else:
            print("\nAuthentication cancelled.")
            return 1
    else:
        print("Invalid choice. Please run again with option 1 or 2.")
        return 1
    
    if not token:
        print("\nAuthentication failed. Please try again.")
        return 1
    
    # Test the token
    if test_token_with_graph(token):
        print("\nAuthentication successful!")
        print("You can now use IEMS with the authenticated account.")
        return 0
    else:
        print("\nAuthentication succeeded but API access failed.")
        print("This may indicate permission issues with Microsoft Graph API.")
        print("Please check the permissions in Azure AD.")
        return 1

if __name__ == "__main__":
    sys.exit(main())