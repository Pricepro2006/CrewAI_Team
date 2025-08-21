#!/bin/bash
# Optimized Production Build Script

set -e

echo "🏗️  Starting optimized production build..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf .vite/

# Set production environment
export NODE_ENV=production

# Build with optimizations
echo "📦 Building frontend with optimizations..."
npm run build

# Analyze bundle (optional)
if command -v npx &> /dev/null; then
    echo "📊 Analyzing bundle size..."
    npx vite-bundle-analyzer dist/ --open false || echo "Bundle analyzer not available"
fi

# Compress assets
echo "🗜️  Compressing static assets..."
find dist/ -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) -exec gzip -9 -c {} \; > {}.gz 2>/dev/null || true

# Remove source maps from production
echo "🧹 Removing source maps from production build..."
find dist/ -name "*.map" -delete

# Show build summary
echo "✅ Build complete!"
echo "📊 Build Summary:"
echo "   Total files: $(find dist/ -type f | wc -l)"
echo "   Total size: $(du -sh dist/ | cut -f1)"
echo "   JS files: $(find dist/ -name "*.js" | wc -l)"
echo "   CSS files: $(find dist/ -name "*.css" | wc -l)"
