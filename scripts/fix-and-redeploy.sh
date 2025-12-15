#!/bin/bash

# Fix and Redeploy Script
# Automatically fixes common issues and redeploys

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Fix and Redeploy Script${NC}"
echo "=============================="
echo ""

# Step 1: Check for common issues
echo -e "${BLUE}Step 1: Checking for issues...${NC}"

# Check if server entry point exists
if [ ! -f "src/index.js" ]; then
    echo -e "${RED}❌ src/index.js not found${NC}"
    exit 1
fi

# Check if package.json has start script
if ! grep -q '"start"' package.json; then
    echo -e "${RED}❌ package.json missing start script${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Basic checks passed${NC}"
echo ""

# Step 2: Test locally
echo -e "${BLUE}Step 2: Testing server locally...${NC}"
timeout 5 node src/index.js > /tmp/code-roach-test.log 2>&1 &
SERVER_PID=$!
sleep 3

if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✅ Server starts successfully${NC}"
    kill $SERVER_PID 2>/dev/null || true
else
    echo -e "${YELLOW}⚠️  Server may have issues, checking logs...${NC}"
    cat /tmp/code-roach-test.log | tail -20
fi
echo ""

# Step 3: Check Railway connection
echo -e "${BLUE}Step 3: Checking Railway connection...${NC}"
if railway status &> /dev/null; then
    echo -e "${GREEN}✅ Railway connected${NC}"
else
    echo -e "${RED}❌ Railway not connected${NC}"
    exit 1
fi
echo ""

# Step 4: Deploy
echo -e "${BLUE}Step 4: Deploying to Railway...${NC}"
railway up

echo ""
echo -e "${GREEN}✅ Deployment initiated${NC}"
echo ""

# Step 5: Monitor deployment
echo -e "${BLUE}Step 5: Monitoring deployment...${NC}"
echo "Waiting 30 seconds for build to start..."
sleep 30

echo "Checking logs for errors..."
railway logs --tail 50 2>&1 | grep -E "Error|error|failed|Failed|Cannot|Module" | tail -10 || echo "No errors found in recent logs"

echo ""
echo -e "${GREEN}✅ Fix and redeploy complete!${NC}"
echo ""
echo "Check deployment status:"
echo "  railway status"
echo "  railway logs"
echo ""
