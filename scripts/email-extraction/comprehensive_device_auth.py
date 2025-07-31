#!/usr/bin/env python3
"""
Comprehensive Device Code Authentication for Microsoft Graph API

This script handles authentication to Microsoft Graph API using the device code flow,
specifically designed for accessing shared mailboxes.

Features:
- Proper scope formatting for Microsoft Graph API
- Comprehensive error handling
- Detailed user instructions
- Testing of basic profile access
- Testing of shared mailbox access
- Token caching and proper storage
"""

import os
import sys
import json
import time
import msal
import requests
from urllib.parse import quote
from datetime import datetime, timedelta

def load_config():
    """Load the configuration from graph_config.json"""
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

def get_proper_scopes(config):
    """Get properly formatted scopes for Microsoft Graph API"""
    # Check if device_code_authentication section exists with scopes
    if (config.get("authentication") and 
        config["authentication"].get("device_code_authentication") and 
        config["authentication"]["device_code_authentication"].get("scopes")):
        raw_scopes = config["authentication"]["device_code_authentication"]["scopes"]
    else:
        # Default scopes needed for shared mailbox access
        raw_scopes = [
            "Mail.Read", 
            "Mail.ReadWrite", 
            "Mail.Read.Shared",
            "Mail.ReadWrite.Shared",
            "Mail.Send.Shared",
            "User.Read"
        ]
    
    # Format the scopes properly for Microsoft Graph API
    graph_scopes = []
    
    # OIDC scopes are kept as is
    oidc_scopes = ["offline_access", "openid", "profile", "email"]
    
    for scope in raw_scopes:
        # OIDC scopes don't need the prefix
        if scope in oidc_scopes:
            graph_scopes.append(scope)
        # For Microsoft Graph scopes, add the prefix if not already present
        elif not scope.startswith("https://graph.microsoft.com"):
            # Add the prefix (this is required by MSAL Python)
            graph_scopes.append(f"https://graph.microsoft.com/{scope}")
        else:
            # Already has the correct prefix, keep as is
            graph_scopes.append(scope)
    
    # Always add offline_access to get refresh tokens
    if "offline_access" not in graph_scopes:
        graph_scopes.append("offline_access")
    
    return graph_scopes

def authenticate_device_code():
    """Authenticate with device code flow and return the token"""
    # Load configuration
    config = load_config()
    if not config:
        return None
    
    client_id = config.get("client_id")
    tenant_id = config.get("tenant_id")
    
    print(f"Using client ID: {client_id}")
    print(f"Using tenant ID: {tenant_id}")
    
    # Get properly formatted scopes
    scopes = get_proper_scopes(config)
    print("\nRequesting the following permissions (scopes):")
    for scope in scopes:
        print(f"  - {scope}")
    
    # Create the MSAL PublicClientApplication
    authority = f"https://login.microsoftonline.com/{tenant_id}"
    app = msal.PublicClientApplication(
        client_id=client_id,
        authority=authority
    )
    
    # Check for existing token cache
    cache_path = "token_cache.json"
    if os.path.exists(cache_path):
        try:
            # Create a SerializableTokenCache
            token_cache = msal.SerializableTokenCache()
            
            # Load the cache data
            with open(cache_path, 'r') as cache_file:
                cache_data = cache_file.read()
                if cache_data:
                    token_cache.deserialize(cache_data)
            
            # Set the token cache on the app
            app.token_cache = token_cache
            
            print("\nFound existing token cache. Attempting to use cached token...")
            accounts = app.get_accounts()
            if accounts:
                print(f"Found {len(accounts)} cached account(s).")
                # Try to silently acquire a token
                result = app.acquire_token_silent(scopes, account=accounts[0])
                if result and "access_token" in result:
                    print("Successfully acquired token from cache!")
                    # Save the refreshed token cache
                    if token_cache.has_state_changed:
                        with open(cache_path, 'w') as cache_file:
                            cache_file.write(token_cache.serialize())
                    return result
                else:
                    print("Cached token is expired or insufficient for requested scopes.")
        except Exception as e:
            print(f"Error using cached token: {e}")
            print("Proceeding with interactive authentication...")
    
    # Start device code flow
    print("\nInitiating device code flow authentication...")
    try:
        flow = app.initiate_device_flow(scopes=scopes)
        
        if "user_code" not in flow:
            print(f"Error: Failed to initiate device code flow:")
            print(f"  Error: {flow.get('error', 'Unknown error')}")
            print(f"  Description: {flow.get('error_description', 'No description available')}")
            return None
        
        # Display instructions
        verification_uri = flow.get('verification_uri')
        user_code = flow.get('user_code')
        expires_in = flow.get('expires_in', 900)  # Default 15 minutes
        
        print("\n" + "=" * 60)
        print("MICROSOFT AUTHENTICATION REQUIRED")
        print("=" * 60)
        print("\nWHY THIS IS NEEDED:")
        print("This system needs permission to read emails from shared mailboxes")
        print("\nSTEPS:")
        print(f"1. Go to: {verification_uri}")
        print(f"2. Enter code: {user_code}")
        print("3. Sign in with your Microsoft account")
        print("4. Click 'Accept' to grant the required permissions")
        print(f"\nThis code will expire in {expires_in} seconds.")
        print("=" * 60)
        
        # Save to a file for easy copying
        try:
            with open("device_code.txt", "w") as f:
                f.write(f"Authentication URL: {verification_uri}\n")
                f.write(f"Code: {user_code}\n")
                f.write(f"Expires in: {expires_in} seconds\n")
                f.write(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            print("\n(Code and URL also saved to device_code.txt)")
        except Exception as e:
            print(f"Warning: Could not save device code to file: {e}")
        
        print("\nWaiting for authentication to complete...")
        
        # Poll for token
        result = app.acquire_token_by_device_flow(flow)
        
        if "access_token" not in result:
            print(f"Error: Token acquisition failed:")
            print(f"  Error: {result.get('error', 'Unknown error')}")
            print(f"  Description: {result.get('error_description', 'No description available')}")
            return None
        
        # Successfully got a token
        print("Successfully authenticated!")
        
        # Save token cache for future use
        try:
            # Check if we're using a SerializableTokenCache
            if isinstance(app.token_cache, msal.SerializableTokenCache) and app.token_cache.has_state_changed:
                with open(cache_path, 'w') as cache_file:
                    cache_file.write(app.token_cache.serialize())
                print(f"Token cache saved to {cache_path}")
            else:
                # Create a new SerializableTokenCache if we don't have one
                token_cache = msal.SerializableTokenCache()
                
                # Add the current token to the cache
                for key in ['access_token', 'refresh_token', 'id_token']:
                    if key in result:
                        token_cache.add(result[key], key)
                
                # Save the cache
                with open(cache_path, 'w') as cache_file:
                    cache_file.write(token_cache.serialize())
                print(f"Token cache saved to {cache_path}")
        except Exception as e:
            print(f"Warning: Could not save token cache: {e}")
        
        return result
        
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        return None

def save_token_files(token_data):
    """Save token data to various files used by the application"""
    try:
        # Format the token data
        formatted_token = {
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token", ""),
            "expires_on": int(time.time()) + token_data.get("expires_in", 3600),
            "scope": token_data.get("scope", ""),
            "token_type": token_data.get("token_type", "Bearer")
        }
        
        # Save to access_token.json (main token file)
        with open("access_token.json", "w") as f:
            json.dump(formatted_token, f, indent=4)
        
        # Save to delegated_token.json (used by delegated authentication flows)
        with open("delegated_token.json", "w") as f:
            json.dump(formatted_token, f, indent=4)
        
        # Also save as plain text for scripts that might need it
        with open("access_token.txt", "w") as f:
            f.write(token_data["access_token"])
            
        print("Token saved to access_token.json, delegated_token.json, and access_token.txt")
        return True
    except Exception as e:
        print(f"Error saving token files: {e}")
        return False

def test_token(token, config):
    """Test the token by accessing Microsoft Graph API endpoints"""
    if not token:
        print("No token available to test.")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }
    
    success = True
    
    try:
        # Test 1: Access /me endpoint to verify basic user profile access
        print("\n=== Testing User Profile Access ===")
        me_response = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers)
        
        if me_response.status_code == 200:
            me_data = me_response.json()
            print(f"Success! Authenticated as: {me_data.get('displayName')} ({me_data.get('userPrincipalName')})")
        else:
            print(f"Failed to access /me endpoint: {me_response.status_code}")
            print(me_response.text)
            success = False
        
        # Test 2: Access mailbox settings
        print("\n=== Testing Mailbox Settings Access ===")
        mailbox_response = requests.get("https://graph.microsoft.com/v1.0/me/mailboxSettings", headers=headers)
        
        if mailbox_response.status_code == 200:
            print("Success! Accessed your mailbox settings.")
        else:
            print(f"Failed to access mailbox settings: {mailbox_response.status_code}")
            print(mailbox_response.text)
            success = False
        
        # Test 3: Try to access shared mailboxes
        if config and config.get("mailboxes") and len(config["mailboxes"]) > 0:
            print("\n=== Testing Shared Mailbox Access ===")
            
            for idx, mailbox in enumerate(config["mailboxes"][:3]):  # Test up to 3 mailboxes
                email = mailbox.get("email")
                if not email:
                    continue
                    
                print(f"\nTesting access to shared mailbox {idx+1}: {email}")
                
                # Try to get mail folders
                try:
                    mailbox_url = f"https://graph.microsoft.com/v1.0/users/{quote(email)}/mailFolders"
                    shared_response = requests.get(mailbox_url, headers=headers)
                    
                    if shared_response.status_code == 200:
                        folders = shared_response.json().get("value", [])
                        print(f"Success! Accessed {len(folders)} folders in the shared mailbox.")
                        
                        # If folders exist, try to access messages in the first folder
                        if folders:
                            folder_id = folders[0]["id"]
                            folder_name = folders[0]["displayName"]
                            
                            print(f"Testing access to messages in folder: {folder_name}")
                            messages_url = f"https://graph.microsoft.com/v1.0/users/{quote(email)}/mailFolders/{folder_id}/messages?$top=1"
                            
                            messages_response = requests.get(messages_url, headers=headers)
                            if messages_response.status_code == 200:
                                messages = messages_response.json().get("value", [])
                                print(f"Success! Retrieved {len(messages)} messages from the folder.")
                            else:
                                print(f"Failed to access messages: {messages_response.status_code}")
                                print(messages_response.text)
                                success = False
                    else:
                        print(f"Failed to access shared mailbox: {shared_response.status_code}")
                        print(shared_response.text)
                        success = False
                except Exception as e:
                    print(f"Error testing shared mailbox: {e}")
                    success = False
        else:
            print("\nNo shared mailboxes configured to test.")
        
        return success
        
    except Exception as e:
        print(f"Error testing token: {e}")
        return False

def main():
    """Main function to run the authentication flow"""
    print("=== Microsoft Graph API Device Code Authentication ===")
    print(f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Load configuration
    config = load_config()
    if not config:
        sys.exit(1)
    
    # Authenticate
    print("\n=== STEP 1: Authentication ===")
    token_result = authenticate_device_code()
    
    if not token_result or "access_token" not in token_result:
        print("\nAuthentication failed. Please check the error messages above.")
        sys.exit(1)
    
    # Extract the token
    token = token_result["access_token"]
    
    # Save token files
    print("\n=== STEP 2: Saving Token ===")
    save_token_files(token_result)
    
    # Test the token
    print("\n=== STEP 3: Testing Token ===")
    test_success = test_token(token, config)
    
    # Summary
    print("\n=== Authentication Summary ===")
    if test_success:
        print("✅ Authentication successful!")
        print("✅ Token saved to required files")
        print("✅ Token tested successfully with Microsoft Graph API")
        print("\nYou can now use the IEMS system to access shared mailboxes.")
        
        # Print token expiration info
        expires_in = token_result.get("expires_in", 3600)
        expiration_time = datetime.now() + timedelta(seconds=expires_in)
        print(f"\nToken expires in: {expires_in} seconds")
        print(f"Token expiration time: {expiration_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        return 0
    else:
        print("❌ Authentication completed but some tests failed.")
        print("   Please check the error messages above.")
        print("\nYou may still be able to use some features of the IEMS system.")
        return 1

if __name__ == "__main__":
    sys.exit(main())