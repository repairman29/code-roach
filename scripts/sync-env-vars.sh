#!/bin/bash

# Environment Variable Sync Script
# Syncs .env file variables to Railway

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Environment Variable Sync${NC}"
echo "=================================="
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

# Check if project is linked and verify it's not "lucky-grace"
if railway status &> /dev/null; then
    CURRENT_PROJECT=$(railway status 2>&1 | grep -i "project" | head -1 || echo "")
    if echo "$CURRENT_PROJECT" | grep -qi "lucky-grace"; then
        echo -e "${RED}⚠️  WARNING: Currently linked to 'lucky-grace' project${NC}"
        echo -e "${YELLOW}This script syncs variables to the current project.${NC}"
        echo -e "${YELLOW}Make sure you want to sync to 'lucky-grace' before continuing.${NC}"
        echo ""
        read -p "Continue anyway? (y/n): " continue_sync
        if [ "$continue_sync" != "y" ] && [ "$continue_sync" != "Y" ]; then
            echo -e "${RED}❌ Sync cancelled${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Project not linked${NC}"
    echo "Linking project..."
    railway link
    # Verify it's not lucky-grace
    CURRENT_PROJECT=$(railway status 2>&1 | grep -i "project" | head -1 || echo "")
    if echo "$CURRENT_PROJECT" | grep -qi "lucky-grace"; then
        echo -e "${YELLOW}⚠️  Linked to 'lucky-grace' project${NC}"
        echo "If you want a different project, run: railway unlink && railway link"
    fi
fi

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found .env file${NC}"
echo ""

# Sync variables
echo "Syncing environment variables to Railway..."
echo ""

SYNCED=0
FAILED=0
SKIPPED=0

while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    
    # Remove quotes from value
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    
    # Skip if value is empty
    [[ -z "$value" ]] && continue
    
    echo -n "Setting $key... "
    
    if railway variables set "$key=$value" 2>/dev/null; then
        echo -e "${GREEN}✅${NC}"
        ((SYNCED++))
    else
        # Check if it already exists
        if railway variables 2>/dev/null | grep -q "^$key="; then
            echo -e "${YELLOW}⚠️  (already exists)${NC}"
            ((SKIPPED++))
        else
            echo -e "${RED}❌${NC}"
            ((FAILED++))
        fi
    fi
done < .env

echo ""
echo "Summary:"
echo -e "  ${GREEN}✅ Synced: $SYNCED${NC}"
echo -e "  ${YELLOW}⚠️  Skipped (already exists): $SKIPPED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "  ${RED}❌ Failed: $FAILED${NC}"
fi
echo ""

echo -e "${GREEN}✅ Sync complete!${NC}"
echo ""
echo "View all variables: railway variables"
echo ""
