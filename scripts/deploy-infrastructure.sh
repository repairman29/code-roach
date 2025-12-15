#!/bin/bash

# Infrastructure Deployment Script
# Automates deployment of 99.99% uptime infrastructure to Railway

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Infrastructure Deployment Script${NC}"
echo "=========================================="
echo ""

# Load .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
    echo -e "${GREEN}✅ Loaded .env file${NC}"
    echo ""
fi

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found${NC}"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

echo -e "${GREEN}✅ Railway CLI ready${NC}"

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Railway${NC}"
    echo "Logging in..."
    railway login
fi

echo -e "${GREEN}✅ Railway login verified${NC}"
echo ""

# Check if project is linked and verify it's not "lucky-grace"
CODE_ROACH_PROJECT_ID="f884c91a-3d81-49c8-a769-354456c1d979"
CURRENT_PROJECT=""
if railway status &> /dev/null; then
    CURRENT_PROJECT=$(railway status 2>&1 | grep -i "project" | head -1 || echo "")
    echo "Current Railway project: $CURRENT_PROJECT"
    
    # Check if it's the Code Roach project (this is good!)
    if echo "$CURRENT_PROJECT" | grep -qi "$CODE_ROACH_PROJECT_ID"; then
        echo -e "${GREEN}✅ Linked to Code Roach project${NC}"
        echo "Project ID: $CODE_ROACH_PROJECT_ID"
    # Check if it's the lucky-grace project (we want to avoid this)
    elif echo "$CURRENT_PROJECT" | grep -qi "lucky-grace"; then
        echo ""
        echo -e "${RED}⚠️  WARNING: Currently linked to 'lucky-grace' project${NC}"
        echo -e "${YELLOW}This script is for deploying 99.99% uptime infrastructure.${NC}"
        echo -e "${YELLOW}We should use a NEW project, not 'lucky-grace'.${NC}"
        echo ""
        read -p "Do you want to create a new project? (y/n): " create_new
        if [ "$create_new" = "y" ] || [ "$create_new" = "Y" ]; then
            echo "Creating new Railway project..."
            railway init
            echo -e "${GREEN}✅ New project created and linked${NC}"
        else
            echo -e "${RED}❌ Deployment cancelled. Please create a new project first.${NC}"
            echo "To create a new project manually:"
            echo "  1. Go to https://railway.app/dashboard"
            echo "  2. Click 'New Project'"
            echo "  3. Name it something like 'smugglers-ha' or 'smugglers-99-99'"
            echo "  4. Then run: railway link"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Project linked (not lucky-grace)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Project not linked${NC}"
    echo ""
    read -p "Do you want to create a new project? (y/n): " create_new
    if [ "$create_new" = "y" ] || [ "$create_new" = "Y" ]; then
        echo "Creating new Railway project..."
        railway init
        echo -e "${GREEN}✅ New project created and linked${NC}"
    else
        echo "Linking to existing project..."
        railway link
        # Verify it's not lucky-grace
        CURRENT_PROJECT=$(railway status 2>&1 | grep -i "project" | head -1 || echo "")
        if echo "$CURRENT_PROJECT" | grep -qi "lucky-grace"; then
            echo -e "${RED}❌ Linked to 'lucky-grace' project. Please use a different project.${NC}"
            echo "Unlink and create new: railway unlink && railway init"
            exit 1
        fi
    fi
fi

echo ""

# Verify railway.json exists
if [ ! -f railway.json ]; then
    echo -e "${RED}❌ railway.json not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ railway.json found${NC}"

# Verify required environment variables
echo ""
echo "Checking environment variables..."

REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
        echo -e "${RED}❌ $var is not set${NC}"
    else
        echo -e "${GREEN}✅ $var is set${NC}"
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    printf '%s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Set them in Railway dashboard:"
    echo "  railway variables set VARIABLE_NAME=value"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo ""

# Sync environment variables to Railway
echo "Syncing environment variables to Railway..."
echo ""

# Read .env file and sync variables
if [ -f .env ]; then
    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remove quotes from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Skip if value is empty
        [[ -z "$value" ]] && continue
        
        echo "Setting $key..."
        railway variables set "$key=$value" 2>/dev/null || echo -e "${YELLOW}⚠️  Failed to set $key (may already exist)${NC}"
    done < .env
    
    echo ""
    echo -e "${GREEN}✅ Environment variables synced${NC}"
else
    echo -e "${YELLOW}⚠️  No .env file found, skipping variable sync${NC}"
fi

echo ""

# Deploy to Railway
echo "Deploying to Railway..."
echo ""

railway up

echo ""
echo -e "${GREEN}✅ Deployment initiated${NC}"
echo ""

# Wait a bit for deployment to start
echo "Waiting for deployment to start..."
sleep 5

# Check deployment status
echo ""
echo "Checking deployment status..."
railway status

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check Railway dashboard for deployment status"
echo "2. Verify health checks: curl https://your-domain.railway.app/api/health"
echo "3. Configure scaling in Railway dashboard (Settings → Scaling)"
echo "4. Set up external monitoring (see MONITORING-SETUP-GUIDE.md)"
echo "5. Set up Redis HA (see INFRASTRUCTURE-SETUP-GUIDE.md)"
echo "6. Set up database read replicas (see INFRASTRUCTURE-SETUP-GUIDE.md)"
echo ""
