# Walmart Product Pricing Update Scripts

This directory contains scripts for maintaining up-to-date pricing information for products in the walmart_grocery.db database using the BrightData MCP service.

## Files Overview

### 🚀 Main Scripts

- **`update-all-product-pricing.ts`** - Comprehensive pricing update script with rate limiting, retries, and detailed logging
- **`run-pricing-update.sh`** - User-friendly shell wrapper with configuration options and progress display
- **`check-pricing-status.ts`** - Status checker and reporting tool

### ⚙️ Configuration

- **`pricing-config.json`** - Configuration profiles for different update scenarios

## Quick Start

### 1. Check Current Status
```bash
# See what needs updating
tsx scripts/check-pricing-status.ts
```

### 2. Run Pricing Update
```bash
# Interactive runner with prompts
./scripts/run-pricing-update.sh

# Or with specific options
./scripts/run-pricing-update.sh --mode development --verbose
```

### 3. Direct Script Execution
```bash
# Run the TypeScript script directly
tsx scripts/update-all-product-pricing.ts
```

## Configuration Modes

| Mode | Batch Size | Batch Delay | Max Retries | Best For |
|------|------------|-------------|-------------|----------|
| **development** | 5 | 3000ms | 2 | Testing and debugging |
| **production** | 10 | 2000ms | 3 | Normal operations (default) |
| **aggressive** | 20 | 1000ms | 2 | Fast updates, higher API usage |
| **conservative** | 3 | 5000ms | 5 | Slow but reliable updates |

## Features

### ✅ Comprehensive Processing
- Processes all products in walmart_grocery.db database
- Prioritizes products without prices or with stale data
- Updates current_price, regular_price, stock status, ratings
- Maintains timestamps for tracking freshness

### 🔄 Smart Retry Logic
- Automatic retry with exponential backoff
- Rate limiting to respect API limits
- Timeout handling per product
- Graceful degradation on failures

### 📊 Progress Tracking
- Real-time progress logging
- Batch-by-batch status updates
- Success/failure rate monitoring
- Price change detection and logging

### 📁 Detailed Reporting
- JSON reports with full results
- Success/failure breakdowns
- Performance metrics
- Price change summaries

## Database Updates

The script updates these fields in the `walmart_products` table:

```sql
current_price           -- Latest price from Walmart
regular_price           -- Regular/original price
in_stock               -- Stock availability
stock_level            -- Quantity in stock
average_rating         -- Product rating
review_count           -- Number of reviews  
last_checked_at        -- When price was last updated
updated_at             -- Record modification time
```

## Error Handling

### Retry Strategy
1. **Network errors**: Automatic retry with exponential backoff
2. **Rate limiting**: Built-in delays between requests  
3. **Invalid URLs**: Skipped with logging
4. **Missing data**: Timestamp updated, marked as failed
5. **Database errors**: Logged but don't stop processing

### Failure Recovery
- Failed products get `last_checked_at` updated
- Detailed error logging for troubleshooting
- Script continues processing remaining products
- Resume capability (prioritizes oldest checks)

## Monitoring

### Log Files
- **Progress logs**: `logs/pricing-update-TIMESTAMP.log`
- **Detailed reports**: `logs/pricing-update-TIMESTAMP.json`
- **Intermediate saves**: `logs/pricing-update-TIMESTAMP-progress.json`

### Key Metrics
- **Success Rate**: Percentage of products successfully updated
- **Processing Rate**: Products processed per minute
- **Price Changes**: Number of products with price changes
- **API Efficiency**: Retries needed, timeouts encountered

## Performance Guidelines

### Batch Size Recommendations
- **Small databases (<100 products)**: Use `development` mode
- **Medium databases (100-1000 products)**: Use `production` mode  
- **Large databases (>1000 products)**: Use `aggressive` mode
- **API rate limits hit**: Use `conservative` mode

### Expected Performance
- **Development mode**: ~1-2 products/minute
- **Production mode**: ~3-5 products/minute
- **Aggressive mode**: ~8-12 products/minute
- **Conservative mode**: ~0.5-1 products/minute

*Note: Actual performance depends on network conditions, API response times, and product data complexity.*

## Usage Examples

### Basic Status Check
```bash
# Quick overview
tsx scripts/check-pricing-status.ts
```

### Production Update
```bash
# Standard production run
./scripts/run-pricing-update.sh --mode production

# With verbose logging
./scripts/run-pricing-update.sh --mode production --verbose
```

### Development Testing
```bash
# Safe development mode (slower but more reliable)
./scripts/run-pricing-update.sh --mode development

# See what would be updated without changes
./scripts/run-pricing-update.sh --dry-run
```

### Emergency Fast Update
```bash
# When you need quick updates (higher API usage)
./scripts/run-pricing-update.sh --mode aggressive --verbose
```

## Troubleshooting

### Common Issues

**1. "tsx command not found"**
```bash
npm install -g tsx
```

**2. "Database not found"**
- Ensure `data/walmart_grocery.db` exists
- Check file permissions

**3. "Too many API failures"**
- Switch to `conservative` mode
- Check network connectivity
- Verify BrightData MCP service configuration

**4. "Script hangs or times out"**
- Reduce batch size
- Increase timeouts in configuration
- Check for network issues

### Debug Information

Enable detailed logging:
```bash
export DEBUG="*"
tsx scripts/update-all-product-pricing.ts
```

Check recent logs:
```bash
ls -la logs/pricing-update-*
tail -f logs/pricing-update-*.log
```

## Integration

### Scheduled Updates
Add to cron for regular updates:
```bash
# Daily at 2 AM
0 2 * * * /path/to/project/scripts/run-pricing-update.sh --mode production >/dev/null 2>&1

# Weekly comprehensive update
0 3 * * 0 /path/to/project/scripts/run-pricing-update.sh --mode aggressive --verbose
```

### Webhook Integration
The script returns appropriate exit codes for automation:
- `0`: Success
- `1`: General failure  
- `2`: Configuration error
- `3`: Database error

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Run with `--verbose` flag for detailed output
3. Use `--dry-run` to test without changes
4. Review the status with `check-pricing-status.ts`