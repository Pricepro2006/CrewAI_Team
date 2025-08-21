#!/bin/bash

# Test Script for Incident Response Tools
# Version: 1.0.0

echo "🧪 Testing Incident Response Tools"
echo "=================================="
echo ""

# Check if scripts exist and are executable
echo "Checking script availability..."

scripts=(
    "scripts/incident_response.sh"
    "scripts/diagnostics/comprehensive_diagnostic.sh"
    "scripts/recovery/quick_fix.sh"
    "scripts/recovery/websocket_recovery.sh"
    "scripts/recovery/database_recovery.sh"
)

for script in "${scripts[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo "✅ $script - OK"
    else
        echo "❌ $script - NOT FOUND or NOT EXECUTABLE"
    fi
done

echo ""
echo "Testing diagnostic script (non-invasive)..."
echo "=========================================="

# Run diagnostic in test mode
if [ -x "scripts/diagnostics/comprehensive_diagnostic.sh" ]; then
    timeout 5 ./scripts/diagnostics/comprehensive_diagnostic.sh 2>/dev/null | head -20
    echo "... (output truncated for test)"
else
    echo "❌ Cannot run diagnostic"
fi

echo ""
echo "✅ Test complete!"
echo ""
echo "Available commands:"
echo "  ./scripts/incident_response.sh          - Main incident response tool"
echo "  ./scripts/incident_response.sh --auto   - Auto-detect and fix"
echo "  ./scripts/incident_response.sh --help   - Show help"
echo ""
echo "For immediate help with an issue, run:"
echo "  ./scripts/incident_response.sh"