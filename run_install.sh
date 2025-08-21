#!/bin/bash

cd /home/pricepro2006/CrewAI_Team

echo "Installing pako package..."
npm install pako

echo "Installing pako types..."
npm install --save-dev @types/pako

echo "Checking if installation was successful..."
npm list pako
npm list @types/pako

echo "Installation complete."