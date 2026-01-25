#!/bin/bash
# HS Code Expert - Deployment Script for cPanel/Linux Server

echo ""
echo "========================================"
echo " HS Code Expert - Server Deployment"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -e "${YELLOW}[1/5]${NC} Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js found: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found. Please install Node.js 14+ first"
    exit 1
fi

# Check npm
echo -e "${YELLOW}[2/5]${NC} Checking npm installation..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓${NC} npm found: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}[3/5]${NC} Installing npm packages..."
npm install
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${RED}✗${NC} Failed to install dependencies"
    exit 1
fi

# Verify PDF
echo -e "${YELLOW}[4/5]${NC} Verifying tariff PDF..."
if [ -f "Customs Tariff of India.pdf" ]; then
    echo -e "${GREEN}✓${NC} PDF file found"
else
    echo -e "${RED}✗${NC} PDF file not found - please upload it"
    exit 1
fi

# Check environment
echo -e "${YELLOW}[5/5]${NC} Checking environment configuration..."
if [ -f ".env" ]; then
    if grep -q "GEMINI_API_KEY" .env; then
        echo -e "${GREEN}✓${NC} Environment configured with Gemini API key"
    else
        echo -e "${YELLOW}⚠${NC} GEMINI_API_KEY not found in .env"
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
    exit 1
fi

echo ""
echo "========================================"
echo " Deployment Complete!"
echo "========================================"
echo ""
echo -e "${GREEN}✓ All checks passed${NC}"
echo ""
echo "To start the server, run:"
echo "  npm start"
echo ""
echo "To run in background (production):"
echo "  npm install -g pm2"
echo "  pm2 start server.js --name 'hs-code-expert'"
echo ""
echo "Health check endpoint:"
echo "  /api/health"
echo ""
