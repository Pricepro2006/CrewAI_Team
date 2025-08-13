#!/usr/bin/env python3
"""
Extract All Emails from 2025 to Present (Extraction Only)

This script extracts emails from Microsoft 365 shared mailboxes using the
device code authentication flow, limited to the date range from January 1, 2025
to the present day. It focuses only on extraction and does not perform analysis.
"""

import os
import sys
import argparse
import subprocess
from datetime import datetime

def run_command(command, description=None):
    """Run a command and print its output"""
    if description:
        print(f"\n=== {description} ===")
    
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        shell=True
    )
    
    # Print output in real-time
    for line in process.stdout:
        print(line, end='')
    
    # Wait for the process to complete
    process.wait()
    return process.returncode

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Extract all emails from 2025 to present (extraction only)")
    parser.add_argument("-l", "--limit", type=int, default=1000, 
                       help="Limit number of emails to extract per mailbox folder (default: 1000)")
    parser.add_argument("-f", "--force-auth", action="store_true", 
                       help="Force re-authentication even if token exists")
    
    args = parser.parse_args()
    
    # Create necessary directories
    os.makedirs("received_emails", exist_ok=True)
    os.makedirs("data", exist_ok=True)
    os.makedirs("data/logs", exist_ok=True)
    
    # Step 1: Authenticate with Microsoft Graph API if needed or forced
    token_path = "data/access_token.json"
    if args.force_auth or not os.path.exists(token_path):
        auth_script_path = "./comprehensive_device_auth.py"
        result = run_command(auth_script_path, "Authenticating with Microsoft Graph API")
        if result != 0:
            print("Authentication failed. Exiting.")
            return result
        print("Authentication successful.")
    else:
        print("Using existing authentication token.")
    
    # Step 2: Extract emails from 2025 to present (all mailboxes)
    extract_script_path = f"./extract_real_emails_2025.py {args.limit}"
    result = run_command(extract_script_path, 
                       f"Extracting up to {args.limit} emails per folder (2025 to present) from all mailboxes")
    
    if result != 0:
        print("Email extraction failed. Exiting.")
        return result
    
    print("\n=== Extraction process complete ===")
    print("Check the 'received_emails' directory for extracted emails.")
    print("\nTo analyze these emails, run:")
    print("  ./analyze_extracted_emails.py -a -e")
    
    # Create a simple summary file of this extraction run
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    with open(f"data/extraction_2025_run_{timestamp}.txt", "w") as f:
        f.write(f"Email extraction run (2025 to present): {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"Email limit per mailbox folder: {args.limit}\n")
        f.write(f"Date range: January 1, 2025 to {datetime.now().strftime('%Y-%m-%d')}\n")
        f.write("\nTo analyze these emails, run:\n")
        f.write("  ./analyze_extracted_emails.py -a -e\n")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())