#!/bin/bash

# Deploy script for production environment
# This script copies .env.prod to .env, builds the project, and deploys to Firebase

set -e  # Exit on any error

echo "🚀 Starting production deployment..."

# Check if .env.prod exists
if [ ! -f ".env.prod" ]; then
    echo "❌ Error: .env.prod file not found!"
    echo "Please create .env.prod with your production environment variables."
    exit 1
fi

# Copy .env.prod to .env
echo "📋 Copying environment variables from .env.prod to .env..."
cp .env.prod .env

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed! Deployment aborted."
    exit 1
fi

# Deploy to Firebase (production project)
echo "🔥 Deploying to Firebase production environment..."
firebase deploy --project prod

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo "✅ Production deployment completed successfully!"
    # Clean up .env file
    echo "🧹 Cleaning up .env file..."
    rm -f .env
    echo "🎉 All done! Your app has been deployed to the production environment."
else
    echo "❌ Firebase deployment failed!"
    # Clean up .env file even on failure
    echo "🧹 Cleaning up .env file..."
    rm -f .env
    exit 1
fi
