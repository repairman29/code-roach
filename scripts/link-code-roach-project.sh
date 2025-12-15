#!/bin/bash

# Link to Code Roach Railway Project
# Project ID: f884c91a-3d81-49c8-a769-354456c1d979
# URL: https://railway.com/project/f884c91a-3d81-49c8-a769-354456c1d979

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CODE_ROACH_PROJECT_ID="f884c91a-3d81-49c8-a769-354456c1d979"

echo -e "${BLUE}🔗 Link to Code Roach Railway Project${NC}"
echo "=========================================="
echo ""
echo "Project ID: $CODE_ROACH_PROJECT_ID"
echo "URL: https://railway.com/project/$CODE_ROACH_PROJECT_ID"
echo ""

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found${NC}"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Railway${NC}"
    echo "Logging in..."
    railway login
fi

echo -e "${GREEN}✅ Railway CLI ready${NC}"
echo ""

# Check current project
CURRENT_PROJECT=""
if railway status &> /dev/null; then
    CURRENT_PROJECT=$(railway status 2>&1 | grep -i "project" | head -1 || echo "")
    echo "Current project: $CURRENT_PROJECT"
    
    # Check if already linked to Code Roach project
    if echo "$CURRENT_PROJECT" | grep -qi "$CODE_ROACH_PROJECT_ID"; then
        echo -e "${GREEN}✅ Already linked to Code Roach project${NC}"
        exit 0
    fi
    
    # Check if linked to lucky-grace
    if echo "$CURRENT_PROJECT" | grep -qi "lucky-grace"; then
        echo -e "${YELLOW}⚠️  Currently linked to 'lucky-grace' project${NC}"
        echo "This script will unlink and link to Code Roach project."
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo "Cancelled."
            exit 0
        fi
        echo "Unlinking current project..."
        railway unlink
    fi
fi

echo ""
echo "Linking to Code Roach project..."
echo ""

# Link to the project using Railway CLI
# Note: Railway CLI doesn't support linking by project ID directly
# We need to use railway link and select the project
echo "Please select the Code Roach project from the list:"
echo "  (Look for project ID: $CODE_ROACH_PROJECT_ID)"
echo ""

railway link

# Verify we're linked to the right project
echo ""
echo "Verifying link..."
if railway status &> /dev/null; then
    NEW_PROJECT=$(railway status 2>&1 | grep -i "project" | head -1 || echo "")
    echo "Linked project: $NEW_PROJECT"
    
    # Check if it contains the project ID or is clearly Code Roach
    if echo "$NEW_PROJECT" | grep -qi "$CODE_ROACH_PROJECT_ID"; then
        echo -e "${GREEN}✅ Successfully linked to Code Roach project${NC}"
    else
        echo -e "${YELLOW}⚠️  Linked project doesn't match expected ID${NC}"
        echo "Please verify you selected the correct project."
        echo "Expected project ID: $CODE_ROACH_PROJECT_ID"
    fi
else
    echo -e "${RED}❌ Failed to link project${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Link complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify: npm run railway:check"
echo "  2. Deploy: npm run deploy:infrastructure"
echo ""
