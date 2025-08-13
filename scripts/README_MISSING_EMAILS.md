# Missing Email Retrieval System

## Overview

This system retrieves missing emails from Microsoft Graph API for specific date ranges and processes them through the existing CrewAI three-phase analysis pipeline.

## Missing Date Ranges

Based on database analysis, these date ranges have missing emails:

- **May 9-31, 2025**: 23 days missing
- **June 1-30, 2025**: Entire month missing (30 days)
- **July 1-25, 2025**: 25 days missing

**Total**: 78 days of missing emails

## Architecture Integration

The system is designed to work with the existing EMAIL_PIPELINE_IMPLEMENTATION_CHECKLIST.md architecture:

```
Microsoft Graph API → Missing Email Retriever → Batch Files → Enhanced Batch Processor → Three-Phase Analyzer → CrewAI Database
```

### Why This Approach?

1. **Preserves Existing Pipeline**: Uses the same three-phase analysis (Phase 1: Quick Classification, Phase 2: Deep Analysis, Phase 3: Final Enrichment)
2. **Maintains Data Quality**: All emails go through the same LLM processing and validation
3. **Consistent Format**: Creates batch files matching existing IEMS format for compatibility
4. **Incremental Processing**: Avoids duplicates by checking existing batch files and database

## Components

### 1. missing_email_retriever.py

Core retrieval engine that:

- Authenticates with Microsoft Graph API using client credentials
- Retrieves emails for missing date ranges with pagination
- Transforms emails to IEMS batch format
- Creates batch files compatible with enhanced_batch_processor.py
- Handles rate limiting, errors, and deduplication

### 2. pull_missing_emails.py

User-friendly wrapper script that:

- Provides command-line interface
- Loads configuration from JSON files
- Integrates with existing pipeline components
- Provides dry-run capability
- Offers comprehensive logging and progress tracking

### 3. Configuration Files

- `graph_api_config.example.json`: Template for API configuration
- Metadata files (`.metadata.json`) for tracking batch processing

## Setup Instructions

### 1. Prerequisites

- Python 3.8+
- Microsoft Graph API access (tenant ID, client ID, client secret)
- Access to user mailbox
- CrewAI Team environment setup

### 2. Install Dependencies

```bash
pip install aiohttp asyncio
```

### 3. Configure API Access

1. Copy the example config:

```bash
cp graph_api_config.example.json graph_api_config.json
```

2. Fill in your Microsoft Graph API credentials:

```json
{
  "tenant_id": "your-tenant-id",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "user_id": "user@company.com",
  "batch_size": 50,
  "page_size": 100
}
```

### 4. Azure AD Application Setup

Your Azure AD application needs these permissions:

- `Mail.Read` (Application permission)
- `User.Read.All` (Application permission)

Grant admin consent for your organization.

## Usage

### Basic Usage

```bash
# Pull missing emails using config file
python scripts/pull_missing_emails.py --config-file scripts/graph_api_config.json

# Dry run to see what would be done
python scripts/pull_missing_emails.py --config-file scripts/graph_api_config.json --dry-run

# Command line configuration
python scripts/pull_missing_emails.py --tenant-id xxx --client-id yyy --client-secret zzz --user-id user@company.com
```

### Advanced Options

```bash
# Custom batch sizes and output directory
python scripts/pull_missing_emails.py --config-file config.json --batch-size 100 --output-dir /custom/path

# With detailed logging
python scripts/pull_missing_emails.py --config-file config.json --log-level DEBUG --log-file missing_emails.log

# Process through pipeline (when integration complete)
python scripts/pull_missing_emails.py --config-file config.json --process-pipeline
```

## Output

### Batch Files

Created in `/home/pricepro2006/CrewAI_Team/data/missing_email_batches/`:

- `missing_emails_batch_1.json` - Email data in IEMS format
- `missing_emails_batch_1.metadata.json` - Processing metadata
- `missing_emails_batch_2.json` - Next batch
- etc.

### Batch File Format

Each batch file contains an array of emails in IEMS format:

```json
[
  {
    "MessageID": "AAMkAD...",
    "Subject": "Email subject",
    "SenderEmail": "sender@company.com",
    "SenderName": "Sender Name",
    "Recipients": "{\"to\": [\"recipient@company.com\"], \"cc\": [], \"bcc\": []}",
    "ReceivedTime": "2025-05-15T10:30:00Z",
    "FolderPath": "Inbox",
    "BodyText": "Email content...",
    "HasAttachments": 0,
    "Importance": "normal",
    "MailboxSource": "user@company.com",
    "ThreadID": "",
    "ConversationID": "",
    "BodyHTML": null,
    "IsRead": 0,
    "ExtractedAt": "2025-07-30T15:45:00.000000",
    "AnalyzedAt": null,
    "SuggestedThemes": null,
    "SuggestedCategory": null,
    "KeyPhrases": null,
    "FullAnalysis": null,
    "IsSynthetic": 0,
    "workflow_state": null,
    "_graph_api_metadata": {
      "original_graph_id": "AAMkAD...",
      "retrieved_at": "2025-07-30T15:45:00.000000",
      "body_content_type": "html",
      "source": "microsoft_graph_api"
    }
  }
]
```

## Processing Pipeline

### Current State

1. ✅ **Pull Missing Emails**: Retrieves emails from Graph API
2. ✅ **Create Batch Files**: Compatible with existing format
3. 🔄 **Enhanced Batch Processor**: Needs integration with missing email batches
4. 🔄 **Three-Phase Analysis**: Ready to process once batch integration complete
5. 🔄 **Database Integration**: Will store in CrewAI.db with analysis results

### Next Steps for Full Integration

1. **Modify Enhanced Batch Processor**: Update to handle missing email batch file format
2. **Pipeline Integration**: Connect missing email batches to three-phase analyzer
3. **Monitoring Integration**: Add to real-time monitor and dashboard
4. **Automated Processing**: Setup scheduled retrieval for ongoing missing emails

## Monitoring and Logging

### Log Levels

- **DEBUG**: Detailed API calls and data transformation
- **INFO**: Progress updates and summary statistics
- **WARNING**: Non-fatal issues and fallbacks
- **ERROR**: Critical errors requiring attention

### Statistics Tracked

- Emails retrieved per date range
- API calls made and rate limiting
- Duplicates detected and skipped
- Batch files created
- Processing times and performance

### Example Output

```
2025-07-30 15:45:00 - INFO - Starting Missing Email Retrieval Process
2025-07-30 15:45:01 - INFO - Found 3380 existing email IDs across all sources
2025-07-30 15:45:02 - INFO - Processing date range: 2025-05-09 to 2025-05-31
2025-07-30 15:45:05 - INFO - Retrieved page 1 with 100 emails
2025-07-30 15:45:08 - INFO - Retrieved 250 new emails from 2025-05-09 to 2025-05-31
2025-07-30 15:45:10 - INFO - Created batch file: missing_emails_batch_1.json with 50 emails
...
2025-07-30 15:50:00 - INFO - Missing Email Retrieval Complete

Summary:
✅ Batch files created: 15
📧 Total emails retrieved: 750
🔄 API calls made: 23
⏳ Rate limit hits: 0
🔁 Duplicates skipped: 50
❌ Errors encountered: 0
```

## Error Handling

### Common Issues

1. **Authentication Failures**: Check tenant ID, client ID, and client secret
2. **Permission Denied**: Ensure application has required Graph API permissions
3. **Rate Limiting**: System automatically handles with exponential backoff
4. **Network Issues**: Retries with configurable limits
5. **Duplicate Detection**: Automatically skips emails already in batch files or database

### Recovery

- Failed API calls are retried automatically
- Processing can be resumed by running the script again
- Existing batch files are preserved and duplicates avoided
- Metadata files track processing state

## Performance

### Expected Performance

- **API Rate Limits**: Respects Microsoft Graph API limits (~1000 requests/minute)
- **Processing Speed**: ~100-200 emails per minute depending on content size
- **Memory Usage**: Minimal - processes in streaming fashion
- **Disk Usage**: ~1-2MB per 100 emails in batch files

### Optimization

- Configurable batch sizes (balance between file size and processing efficiency)
- Pagination handling for large date ranges
- Connection pooling for multiple API calls
- Efficient duplicate detection using sets

## Security

### Best Practices

- Store credentials in secure configuration files (not in code)
- Use application permissions (not delegated) for service accounts
- Rotate client secrets regularly
- Monitor API usage and access logs
- Limit batch file access permissions

### Data Protection

- Email content stored temporarily in batch files
- No persistent credential storage
- Secure transmission via HTTPS
- Audit trail in metadata files

## Troubleshooting

### Debug Mode

```bash
python scripts/pull_missing_emails.py --config-file config.json --log-level DEBUG --log-file debug.log
```

### Common Solutions

1. **No emails retrieved**: Check date ranges and user mailbox access
2. **Authentication errors**: Verify Azure AD application setup
3. **Permission errors**: Ensure admin consent granted
4. **Rate limiting**: Increase delay configuration or process in smaller batches
5. **File errors**: Check output directory permissions

### Support

For issues:

1. Check log files for detailed error messages
2. Verify configuration against working examples
3. Test with dry-run mode first
4. Review Microsoft Graph API documentation for changes

## Integration with CrewAI Team

This system is designed to integrate seamlessly with:

- **Email Dashboard**: Will show retrieved emails once processed
- **Three-Phase Analysis**: Maintains quality and consistency
- **Real-Time Monitor**: Can track missing email retrieval jobs
- **Database Schema**: Preserves all existing functionality

The missing email retrieval fills the gaps in historical data while maintaining the high-quality analysis standards of the CrewAI Team email processing system.
