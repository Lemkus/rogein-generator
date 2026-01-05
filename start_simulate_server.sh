#!/bin/bash

# Audio Navigation Simulator Server
# Launches HTTP server and opens the simulator page

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default port
PORT=8000

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║       🎮 Audio Navigation Simulator Server 🎮           ║"
    echo "║                                                          ║"
    echo "║          Test navigation sounds interactively!          ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if port is available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Find available port
find_available_port() {
    local port=$1
    if check_port $port; then
        echo $port
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  Port $port is already in use!${NC}"
    echo "   Trying alternative ports..."
    
    for alt_port in 8001 8080 8888 3000; do
        if check_port $alt_port; then
            echo -e "${GREEN}✅ Using port $alt_port instead${NC}"
            echo $alt_port
            return 0
        fi
    done
    
    echo -e "${RED}❌ No available ports found. Please close other servers.${NC}"
    return 1
}

# Main execution
main() {
    clear
    print_banner
    
    # Get script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    cd "$SCRIPT_DIR"
    
    # Find available port
    PORT=$(find_available_port $PORT)
    if [ $? -ne 0 ]; then
        exit 1
    fi
    
    URL="http://localhost:$PORT/audio-navigation-simulator.html"
    
    echo "============================================================"
    echo -e "${GREEN}🚀 Starting server...${NC}"
    echo -e "📂 Working directory: $SCRIPT_DIR"
    echo -e "🌐 Simulator URL: ${BLUE}$URL${NC}"
    echo "============================================================"
    echo ""
    echo "📋 Quick Guide:"
    echo "  • Use Arrow Keys or WASD to move the player"
    echo "  • Click on canvas to teleport"
    echo "  • Navigate to yellow targets in order"
    echo "  • Audio feedback helps guide you to targets"
    echo "  • Press Space to test sound at current distance"
    echo ""
    echo "🛠️ Available Pages:"
    echo "  • Simulator: http://localhost:$PORT/audio-navigation-simulator.html"
    echo "  • Debug: http://localhost:$PORT/audio-debug.html"
    echo "  • Improved: http://localhost:$PORT/improved-sounds-test.html"
    echo ""
    echo -e "${YELLOW}⏹️ Press Ctrl+C to stop the server${NC}"
    echo "============================================================"
    echo ""
    
    # Try to open browser after a short delay (in background)
    (sleep 2 && open_browser) &
    
    # Start server
    if command -v python3 &> /dev/null; then
        # Try Python 3 script first
        python3 start_simulate_server.py 2>/dev/null || python3 -m http.server $PORT
    elif command -v python &> /dev/null; then
        # Fall back to Python 2
        python start_simulate_server.py 2>/dev/null || python -m SimpleHTTPServer $PORT
    else
        echo -e "${RED}❌ Python is not installed!${NC}"
        echo "Please install Python to run the server."
        exit 1
    fi
}

# Open browser function
open_browser() {
    URL="http://localhost:$PORT/audio-navigation-simulator.html"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open "$URL" 2>/dev/null && echo -e "${GREEN}✅ Browser opened${NC}" || true
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v xdg-open &> /dev/null; then
            xdg-open "$URL" 2>/dev/null && echo -e "${GREEN}✅ Browser opened${NC}" || true
        fi
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Windows via Git Bash or Cygwin
        start "$URL" 2>/dev/null && echo -e "${GREEN}✅ Browser opened${NC}" || true
    fi
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${RED}🛑 Server stopped${NC}"; exit 0' INT

# Run main function
main
