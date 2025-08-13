# Microsoft Graph API Token Refresh Guide

## Overview
The Microsoft Graph API token expires after 1 hour. This guide explains how to refresh the token to continue accessing emails.

## Quick Refresh Command

From the email extraction directory:
```bash
cd /home/pricepro2006/CrewAI_Team/scripts/email-extraction/
python3 refresh_token.py
```

## How It Works

The `refresh_token.py` script handles two scenarios:

### 1. Automatic Refresh (Most Common)
- If your existing token has a `refresh_token`, it will automatically refresh without user interaction
- The script will display:
  ```
  🔄 Attempting to refresh token...
  ✅ Token refreshed successfully!
  New token expires in: 3600 seconds
  Authenticated as: [Your Name]
  ```

### 2. Device Code Authentication (When Refresh Fails)
- If the refresh token is expired or invalid, you'll need to re-authenticate
- The script will display a code like:
  ```
  === To authenticate, follow these steps: ===
  1. Go to: https://microsoft.com/devicelogin
  2. Enter code: ABCD1234
  3. Sign in with your Microsoft account
  ```
- Follow these steps to authenticate and get a new token

## Token Status Check

The script also checks if your token is still valid:
- If valid for more than 5 minutes, it displays:
  ```
  ✅ Token is still valid!
  Expires in: 45 minutes
  ```

## Token Files

- **Configuration**: `graph_config.json` (contains client_id and tenant_id)
- **Token Storage**: `access_token.json` (contains access token and refresh token)

## Common Issues

1. **"graph_config.json not found!"**
   - Make sure you're in the correct directory
   - Run: `cd /home/pricepro2006/CrewAI_Team/scripts/email-extraction/`

2. **"Refresh token failed, need to re-authenticate"**
   - This is normal after extended periods
   - Follow the device code authentication steps

3. **Token expires frequently**
   - Microsoft Graph tokens expire after 1 hour by design
   - Use the refresh script before running email extraction

## Integration with Email Scripts

Before running any email extraction script:
```bash
# 1. Check/refresh token
python3 refresh_token.py

# 2. Run your email script
python3 extract-20-emails.py
# or
python3 pull-and-analyze-may-july-emails.py
```

## Automated Refresh (Optional)

You can add token refresh to your scripts:
```python
import subprocess
import os

# Refresh token before main logic
os.chdir('/home/pricepro2006/CrewAI_Team/scripts/email-extraction/')
subprocess.run(['python3', 'refresh_token.py'])

# Continue with email extraction...
```

## Security Notes

- Never share your `access_token.json` file
- The refresh token allows obtaining new access tokens
- Tokens are specific to the configured scopes (Mail.Read, Mail.ReadWrite, etc.)
- Device code authentication requires manual approval for security

## Schedule Recommendation

For continuous email monitoring:
- Run token refresh every 45 minutes to ensure uninterrupted access
- Or refresh before each email extraction batch

## Troubleshooting

If you encounter issues:
1. Check network connectivity
2. Verify `graph_config.json` has correct client_id and tenant_id
3. Ensure you have the correct permissions in Azure AD
4. Try deleting `access_token.json` to force fresh authentication