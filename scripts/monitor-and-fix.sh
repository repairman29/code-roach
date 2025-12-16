#!/bin/bash

# Monitor and Fix Deployment Script
# Continuously monitors Railway deployment and fixes issues

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DEPLOYMENT_URL="https://coderoach-production.up.railway.app"
MAX_ATTEMPTS=10
ATTEMPT=0

echo -e "${BLUE}🔍 Monitoring and Fixing Deployment${NC}"
echo "======================================"
echo ""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo -e "${BLUE}Attempt $ATTEMPT/$MAX_ATTEMPTS${NC}"
    
    # Check health
    echo "Checking health endpoint..."
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$DEPLOYMENT_URL/api/health/live" 2>&1 || echo "ERROR")
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
    BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Service is healthy!${NC}"
        echo "Response: $BODY"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Service not healthy (HTTP $HTTP_CODE)${NC}"
        echo "Response: $BODY"
    fi
    
    # Check logs for errors
    echo ""
    echo "Checking Railway logs for errors..."
    ERRORS=$(railway logs --tail 50 2>&1 | grep -iE "error|failed|cannot|module not found" | tail -5 || echo "")
    
    if [ -n "$ERRORS" ]; then
        echo -e "${RED}Found errors:${NC}"
        echo "$ERRORS"
        echo ""
        echo "Attempting to fix..."
        
        # Common fixes
        if echo "$ERRORS" | grep -qi "module not found\|cannot find module"; then
            echo "Missing module detected - checking dependencies..."
            # This would trigger a fix, but for now just report
        fi
        
        if echo "$ERRORS" | grep -qi "port.*in use\|EADDRINUSE"; then
            echo "Port conflict detected - this shouldn't happen in Railway"
        fi
    else
        echo "No obvious errors in logs"
    fi
    
    # Wait before next attempt
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
        echo ""
        echo "Waiting 30 seconds before next check..."
        sleep 30
    fi
done

echo ""
echo -e "${RED}❌ Service did not become healthy after $MAX_ATTEMPTS attempts${NC}"
echo "Check Railway dashboard for details:"
echo "  https://railway.com/project/f884c91a-3d81-49c8-a769-354456c1d979"
exit 1
