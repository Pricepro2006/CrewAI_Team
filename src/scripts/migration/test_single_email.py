#!/usr/bin/env python3
"""Test migration of a single email to debug issues"""

import sqlite3
import json

# Connect to both databases
source_conn = sqlite3.connect('/home/pricepro2006/CrewAI_Team/data/crewai.db')
source_conn.row_factory = sqlite3.Row
target_conn = sqlite3.connect('/home/pricepro2006/CrewAI_Team/data/app.db')
target_conn.row_factory = sqlite3.Row

# Get one email from source
email = source_conn.execute("SELECT * FROM emails_enhanced LIMIT 1").fetchone()
print(f"Source email ID: {email['id']}")
print(f"Source graph_id: {email['graph_id']}")
print(f"Subject: {email['subject']}")

# Check if it exists in target
existing = target_conn.execute("SELECT id FROM emails WHERE graph_id = ?", (email['graph_id'],)).fetchone()
if existing:
    print(f"Email already exists in target with ID: {existing['id']}")
else:
    print("Email does not exist in target database")

# Check email_analysis table
analysis = target_conn.execute("SELECT * FROM email_analysis WHERE email_id = ?", (existing['id'] if existing else 'none',)).fetchone()
if analysis:
    print(f"Analysis exists: {analysis['id']}")
else:
    print("No analysis found")

# Close connections
source_conn.close()
target_conn.close()