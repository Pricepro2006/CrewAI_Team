#!/bin/bash

# IEMS to Email Dashboard Migration Runner
# This script runs the complete data migration pipeline

set -e  # Exit on error

echo "=============================================="
echo "IEMS to Email Dashboard Migration"
echo "=============================================="
echo ""

# Check if running from correct directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../../.."

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Check if databases exist
if [ ! -f "$PROJECT_ROOT/data/email_dashboard.db" ]; then
    echo "Creating email dashboard database..."
    mkdir -p "$PROJECT_ROOT/data"
    touch "$PROJECT_ROOT/data/email_dashboard.db"
fi

# Check if IEMS analysis results exist
IEMS_RESULTS="/home/pricepro2006/iems_project/analysis_results"
if [ ! -d "$IEMS_RESULTS" ]; then
    echo "Error: IEMS analysis results not found at $IEMS_RESULTS"
    exit 1
fi

# Count analysis files
ANALYSIS_COUNT=$(ls -1 "$IEMS_RESULTS"/analysis_batch_*.txt 2>/dev/null | wc -l)
echo "Found $ANALYSIS_COUNT analysis batch files to process"
echo ""

# Run the migration pipeline
echo "Starting migration pipeline..."
echo "This may take several minutes depending on the amount of data..."
echo ""

# Execute the pipeline
python3 "$SCRIPT_DIR/data_pipeline.py"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "=============================================="
    echo "Migration completed successfully!"
    echo "=============================================="
    echo ""
    echo "Check logs at: $PROJECT_ROOT/logs/data_pipeline.log"
    echo "Results saved to: $PROJECT_ROOT/logs/pipeline_results.json"
else
    echo ""
    echo "=============================================="
    echo "Migration failed!"
    echo "=============================================="
    echo ""
    echo "Check logs at: $PROJECT_ROOT/logs/data_pipeline.log"
    exit 1
fi