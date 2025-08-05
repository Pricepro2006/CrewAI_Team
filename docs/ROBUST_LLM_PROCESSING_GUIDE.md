# Robust LLM Email Processing Pipeline

## Overview

The robust LLM processing pipeline addresses timeout issues and implements efficient batch processing for the CrewAI email analysis system. This solution processes 143,850+ emails using a three-phase adaptive approach with Ollama-hosted models.

## Key Features

### 1. **Async Batch Processing**
- Processes emails in configurable batches (default: 15 emails)
- Concurrent processing within each batch for maximum throughput
- Target: 60+ emails/minute processing speed

### 2. **Timeout Handling**
- Configurable timeouts (45s per LLM call)
- Automatic retry logic with exponential backoff
- Graceful degradation on failures

### 3. **Resume Capability**
- Tracks processing state in database
- Can resume from interruption
- Marks failed emails for retry

### 4. **Three-Phase Adaptive Processing**
- **Phase 1**: Rule-based (completeness ≥ 0.7) - No LLM required
- **Phase 2**: Llama 3.2:3b (0.3 ≤ completeness < 0.7)
- **Phase 3**: Phi-4 (completeness < 0.3) - Complex analysis

## Scripts

### 1. `robust_llm_processor.py` - Main Processing Engine

```bash
# Run the processor
python scripts/robust_llm_processor.py

# Features:
# - Async/await architecture
# - Batch sizes optimized for throughput
# - Comprehensive error handling
# - Progress tracking
# - Graceful shutdown (Ctrl+C)
```

### 2. `monitor_processing.py` - Real-time Monitor

```bash
# Monitor progress in another terminal
python scripts/monitor_processing.py

# Shows:
# - Processing speed (emails/minute)
# - Phase distribution
# - Error rates
# - ETA for completion
# - Average processing times
```

### 3. `test_ollama_models.py` - Pre-flight Check

```bash
# Test Ollama and model availability
python scripts/test_ollama_models.py

# Verifies:
# - Ollama connection
# - Required models installed
# - Model response times
# - JSON parsing capability
```

### 4. `reset_failed_emails.py` - Retry Management

```bash
# Reset failed emails for reprocessing
python scripts/reset_failed_emails.py

# Reset specific statuses
python scripts/reset_failed_emails.py "failed,timeout"
```

## Database Schema

The pipeline uses these key columns in `emails_enhanced`:
- `status`: pending, processing, analyzed, phase2_complete, phase3_complete, failed, timeout
- `phase_completed`: 1, 2, or 3
- `workflow_state`: JSON with analysis results
- `phase[1-3]_result`: Phase-specific results
- `analyzed_at`: Timestamp of completion

## Processing Flow

```
1. Get batch of pending emails (ordered by completeness_score DESC)
2. Mark batch as 'processing'
3. Route each email to appropriate phase based on completeness
4. Process batch concurrently with async/await
5. Update database with results
6. Handle failures gracefully
7. Repeat until no pending emails
```

## Configuration

### Batch Size Optimization
- Default: 15 emails per batch
- Adjust based on your hardware:
  - Low-end: 5-10 emails
  - Mid-range: 10-20 emails
  - High-end: 20-30 emails

### Timeout Settings
- Connection timeout: 5s
- Read timeout: 50s
- Total timeout: 60s per request
- Retry delays: 2s, 4s, 8s (exponential)

### Concurrency Limits
- Max concurrent Ollama connections: 5
- Prevents overloading the LLM service

## Monitoring & Troubleshooting

### Check Processing Status
```sql
-- In SQLite
SELECT status, COUNT(*) 
FROM emails_enhanced 
GROUP BY status;
```

### Common Issues

1. **Timeouts**
   - Reduce batch size
   - Check Ollama performance
   - Ensure models are loaded in memory

2. **Slow Processing**
   - Check GPU availability
   - Monitor system resources
   - Consider running multiple instances

3. **Failed Emails**
   - Use reset script to retry
   - Check logs for specific errors
   - Verify model responses

### Performance Metrics

Expected performance:
- Phase 1 (Rules): 500+ emails/minute
- Phase 2 (Llama 3.2): 80-100 emails/minute
- Phase 3 (Phi-4): 40-60 emails/minute
- Overall average: 60-80 emails/minute

## Best Practices

1. **Pre-flight Checks**
   - Always run `test_ollama_models.py` first
   - Ensure adequate disk space for logs
   - Monitor system resources

2. **Production Running**
   - Use `screen` or `tmux` for long runs
   - Monitor with separate terminal
   - Keep logs for debugging

3. **Error Recovery**
   - Let the processor handle retries
   - Reset failed emails periodically
   - Check for patterns in failures

## Example Session

```bash
# Terminal 1 - Start processing
cd /home/pricepro2006/CrewAI_Team
python scripts/robust_llm_processor.py

# Terminal 2 - Monitor progress
python scripts/monitor_processing.py

# If needed - reset failures
python scripts/reset_failed_emails.py
```

## Integration with Email Pipeline

This processor integrates with the broader email pipeline:
1. Emails are imported and scored for completeness
2. This processor analyzes them through appropriate phases
3. Results stored in `workflow_state` as JSON
4. Frontend displays analyzed results
5. Agents can use the extracted intelligence

## Next Steps

After processing completes:
1. Verify all emails processed: Check database stats
2. Review failed emails: Investigate patterns
3. Export results: Use for agent training
4. Optimize: Adjust batch sizes based on performance