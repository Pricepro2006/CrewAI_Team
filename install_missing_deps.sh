#!/bin/bash

echo "Installing missing dependencies..."

# Install pako for compression in MessageBatcher
npm install pako

# Install types for pako
npm install --save-dev @types/pako

echo "Dependencies installation complete."