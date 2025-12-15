#!/bin/bash

# Monitoring Setup Automation Script
# Helps set up external monitoring services for 99.99% uptime

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Monitoring Setup Automation${NC}"
echo "===================================="
echo ""

APP_URL="${1:-${APP_URL:-http://localhost:3000}}"

echo "This script will help you set up monitoring services."
echo "App URL: ${APP_URL}"
echo ""

# Check if APP_URL is set
if [ -z "$APP_URL" ] || [ "$APP_URL" == "http://localhost:3000" ]; then
    echo -e "${YELLOW}⚠️  APP_URL not set. Using localhost:3000${NC}"
    echo "Set APP_URL environment variable or pass as first argument:"
    echo "  APP_URL=https://your-domain.com ./scripts/setup-monitoring.sh"
    echo ""
fi

echo "Available monitoring services:"
echo "1. UptimeRobot (Free - 50 monitors)"
echo "2. Datadog (14-day trial, then $15/host/month)"
echo "3. Sentry (Already configured - verify only)"
echo "4. PagerDuty (Free tier - 5 users)"
echo "5. Logtail (Free tier - 1GB/month)"
echo ""

read -p "Which service would you like to set up? (1-5, or 'all'): " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}📡 UptimeRobot Setup${NC}"
        echo "===================="
        echo ""
        echo "1. Go to https://uptimerobot.com and sign up"
        echo "2. Click 'Add New Monitor'"
        echo "3. Configure:"
        echo "   - Monitor Type: HTTP(s)"
        echo "   - Friendly Name: Production API Health"
        echo "   - URL: ${APP_URL}/api/health"
        echo "   - Monitoring Interval: 5 minutes"
        echo "   - Alert Contacts: Add your email/SMS"
        echo ""
        echo "4. Add additional monitors:"
        echo "   - Liveness: ${APP_URL}/api/health/live"
        echo "   - Readiness: ${APP_URL}/api/health/ready"
        echo "   - Circuit Breakers: ${APP_URL}/api/health/circuit-breakers"
        echo ""
        echo "5. Configure alerts:"
        echo "   - Email alerts for all monitors"
        echo "   - SMS alerts for critical monitors"
        echo "   - Webhook for PagerDuty (if using)"
        echo ""
        ;;
    2)
        echo ""
        echo -e "${BLUE}📈 Datadog Setup${NC}"
        echo "================"
        echo ""
        echo "1. Go to https://www.datadoghq.com and sign up (14-day free trial)"
        echo "2. Install APM agent:"
        echo "   npm install dd-trace"
        echo ""
        echo "3. Add to server/server.js (after require statements):"
        echo "   const tracer = require('dd-trace').init({"
        echo "     service: 'smugglers-api',"
        echo "     env: process.env.NODE_ENV"
        echo "   });"
        echo ""
        echo "4. Set environment variable:"
        echo "   DD_API_KEY=your-api-key"
        echo ""
        echo "5. Create dashboards in Datadog:"
        echo "   - Request rate"
        echo "   - Error rate"
        echo "   - Response times (p50, p95, p99)"
        echo "   - Database query times"
        echo ""
        echo "6. Set up alerts:"
        echo "   - Error rate > 5%"
        echo "   - Response time p95 > 1 second"
        echo "   - Circuit breaker opens"
        echo ""
        ;;
    3)
        echo ""
        echo -e "${BLUE}🐛 Sentry Verification${NC}"
        echo "======================"
        echo ""
        if [ -z "$SENTRY_DSN" ]; then
            echo -e "${YELLOW}⚠️  SENTRY_DSN not set${NC}"
            echo ""
            echo "To set up Sentry:"
            echo "1. Go to https://sentry.io and sign up"
            echo "2. Create a new project (Node.js)"
            echo "3. Copy your DSN"
            echo "4. Set environment variable:"
            echo "   SENTRY_DSN=your-sentry-dsn"
            echo "5. Add to Railway:"
            echo "   railway variables set SENTRY_DSN=your-sentry-dsn"
        else
            echo -e "${GREEN}✅ SENTRY_DSN is set${NC}"
            echo ""
            echo "Verify Sentry is working:"
            echo "1. Go to Sentry dashboard"
            echo "2. Check for errors"
            echo "3. Set up alert rules:"
            echo "   - New issues"
            echo "   - Error rate spikes"
            echo "   - Critical errors"
        fi
        echo ""
        ;;
    4)
        echo ""
        echo -e "${BLUE}📞 PagerDuty Setup${NC}"
        echo "=================="
        echo ""
        echo "1. Go to https://www.pagerduty.com and sign up (Free tier: 5 users)"
        echo "2. Create service:"
        echo "   - Service Name: Smugglers API"
        echo "   - Escalation Policy: Create policy"
        echo "   - Integration: Add UptimeRobot webhook"
        echo ""
        echo "3. Add on-call schedule:"
        echo "   - Create rotation schedule"
        echo "   - Add team members"
        echo "   - Set escalation rules"
        echo ""
        echo "4. Configure integrations:"
        echo "   - UptimeRobot → PagerDuty webhook"
        echo "   - Datadog → PagerDuty integration"
        echo "   - Sentry → PagerDuty integration"
        echo ""
        echo "5. Test alerts:"
        echo "   - Trigger test alert"
        echo "   - Verify notification delivery"
        echo "   - Test escalation"
        echo ""
        ;;
    5)
        echo ""
        echo -e "${BLUE}📝 Logtail Setup${NC}"
        echo "================="
        echo ""
        echo "1. Go to https://logtail.com and sign up (Free tier: 1GB/month)"
        echo "2. Install library:"
        echo "   npm install @logtail/node"
        echo ""
        echo "3. Set environment variable:"
        echo "   LOGTAIL_TOKEN=your-logtail-token"
        echo ""
        echo "4. Add to server/server.js:"
        echo "   const { Logtail } = require('@logtail/node');"
        echo "   const logtail = new Logtail(process.env.LOGTAIL_TOKEN);"
        echo ""
        echo "5. Use in error handlers:"
        echo "   logtail.error('Error message', { context });"
        echo ""
        echo "6. Set up alerts:"
        echo "   - Error log alerts"
        echo "   - Critical log alerts"
        echo "   - Pattern-based alerts"
        echo ""
        ;;
    all)
        echo ""
        echo -e "${BLUE}🚀 Setting up all monitoring services...${NC}"
        echo ""
        echo "See MONITORING-SETUP-GUIDE.md for detailed instructions."
        echo ""
        echo "Quick checklist:"
        echo "  [ ] UptimeRobot - Uptime monitoring"
        echo "  [ ] Datadog - APM and metrics"
        echo "  [ ] Sentry - Error tracking"
        echo "  [ ] PagerDuty - On-call management"
        echo "  [ ] Logtail - Log aggregation"
        echo ""
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Setup instructions displayed${NC}"
echo ""
echo "For detailed instructions, see: docs/MONITORING-SETUP-GUIDE.md"
echo ""
