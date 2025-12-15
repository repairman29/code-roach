#!/bin/bash

# Railway Project Check Script
# Verifies which Railway project is currently linked

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Railway Project Check${NC}"
echo "=========================="
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
    echo "Run: railway login"
    exit 1
fi

echo -e "${GREEN}✅ Railway CLI ready${NC}"
echo ""

# Check if project is linked
if ! railway status &> /dev/null; then
    echo -e "${YELLOW}⚠️  No project linked${NC}"
    echo ""
    echo "To link a project:"
    echo "  railway link    # Link to existing project"
    echo "  railway init    # Create new project"
    exit 0
fi

# Get project info
echo "Current Railway Project:"
echo "========================"
railway status
echo ""

# Check for Code Roach project or lucky-grace
CODE_ROACH_PROJECT_ID="f884c91a-3d81-49c8-a769-354456c1d979"
PROJECT_INFO=$(railway status 2>&1)

if echo "$PROJECT_INFO" | grep -qi "$CODE_ROACH_PROJECT_ID"; then
    echo -e "${GREEN}✅ Linked to Code Roach project${NC}"
    echo "Project ID: $CODE_ROACH_PROJECT_ID"
    echo "URL: https://railway.com/project/$CODE_ROACH_PROJECT_ID"
    echo ""
    echo "Perfect! This is the correct project for Code Roach 99.99% uptime infrastructure."
elif echo "$PROJECT_INFO" | grep -qi "lucky-grace"; then
    echo -e "${RED}⚠️  WARNING: Linked to 'lucky-grace' project${NC}"
    echo ""
    echo "For 99.99% uptime infrastructure, you should use the Code Roach project."
    echo ""
    echo "To link to Code Roach project:"
    echo "  npm run railway:link-code-roach"
    echo ""
    echo "Or manually:"
    echo "  1. railway unlink"
    echo "  2. railway link"
    echo "  3. Select project: $CODE_ROACH_PROJECT_ID"
else
    echo -e "${YELLOW}⚠️  Project is not 'lucky-grace' or Code Roach project${NC}"
    echo ""
    echo "For Code Roach 99.99% uptime infrastructure, link to:"
    echo "  npm run railway:link-code-roach"
    echo ""
    echo "Or verify this is the correct project for your deployment."
fi

echo ""
