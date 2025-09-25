#!/bin/bash

# Deploy script for development environment
# This script copies .env.dev to .env, builds the project, and deploys to Firebase

set -e  # Exit on any error

echo "🚀 Starting development deployment..."

# Check if .env.dev exists
if [ ! -f ".env.dev" ]; then
    echo "❌ Error: .env.dev file not found!"
    echo "Please create .env.dev with your development environment variables."
    exit 1
fi

# Copy .env.dev to .env
echo "📋 Copying environment variables from .env.dev to .env..."
cp .env.dev .env

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed! Deployment aborted."
    exit 1
fi

# Deploy to Firebase (development project)
echo "🔥 Deploying to Firebase development environment..."
firebase deploy --project dev

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo "✅ Development deployment completed successfully!"
    # Clean up .env file
    echo "🧹 Cleaning up .env file..."
    rm -f .env
    echo "🎉 All done! Your app has been deployed to the development environment."
else
    echo "❌ Firebase deployment failed!"
    # Clean up .env file even on failure
    echo "🧹 Cleaning up .env file..."
    rm -f .env
    exit 1
fi
