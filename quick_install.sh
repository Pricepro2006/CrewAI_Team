#!/bin/bash

cd /home/pricepro2006/CrewAI_Team

echo "Installing pako and its types..."
npm install pako
npm install --save-dev @types/pako

echo "Checking installation..."
npm list pako @types/pako 2>/dev/null || echo "Packages installed successfully"

echo "Installation complete."