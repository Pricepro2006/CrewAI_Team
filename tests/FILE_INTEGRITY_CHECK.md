# File Integrity Monitoring

## Quick File Integrity Check

Run this command to check for file corruption:

```bash
# Check for literal escape sequences
find tests/ -name "*.ts" -exec grep -l '\\n' {} \; 2>/dev/null
find tests/ -name "*.ts" -exec grep -l '\\"' {} \; 2>/dev/null

# If files are found, they likely contain corruption
```

## Automatic Fix Script

```bash
#!/bin/bash
# Fix literal escape sequences in TypeScript files

find tests/ -name "*.ts" -print0 | while IFS= read -r -d '' file; do
    if grep -q '\\n\|\\\"' "$file"; then
        echo "Fixing: $file"
        sed -i 's/\\n/\n/g' "$file"
        sed -i 's/\\"/"/g' "$file"
    fi
done
```

## Prevention Measures Implemented

1. **Pre-commit Hook**: Automatically checks for literal escape sequences
2. **EditorConfig**: Ensures consistent line endings and encoding
3. **Documentation**: Guidelines for developers

## Common Corruption Patterns

- `\\n` instead of actual newlines
- `\\"` instead of actual quotes  
- Usually appears at line 7 after JSDoc comments
- Affects TypeScript compilation with TS1127 errors

## Recovery Status

✅ **FULLY RECOVERABLE** - All corrupted files have been successfully restored with no data loss.