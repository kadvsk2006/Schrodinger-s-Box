#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "📦 Building Schrödinger's Box for Render Deployment..."

# 1. Frontend Build
echo "➡️  Step 1: Installing Frontend Dependencies..."
cd frontend
npm install

echo "➡️  Step 2: Compiling Vite React App..."
npm run build
cd ..

# 2. Backend Build
echo "➡️  Step 3: Installing Backend Python Dependencies..."
cd backend
pip install -r requirements.txt
cd ..

echo "✅ Build Complete! The FastAPI server will automatically mount frontend/dist."
