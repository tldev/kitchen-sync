#!/bin/zsh
# Development helper script for Kitchen Sync

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Kitchen Sync Development Environment${NC}\n"

case "${1:-start}" in
  start)
    echo -e "${GREEN}Starting development containers...${NC}"
    docker-compose -f docker-compose.dev.yml up -d
    echo -e "\n${GREEN}✅ Development server starting!${NC}"
    echo -e "${BLUE}📝 Next.js will be available at: http://localhost:3000${NC}"
    echo -e "${BLUE}📊 PostgreSQL available at: localhost:5432${NC}"
    echo -e "${BLUE}🗄️  Adminer (Postgres UI): http://localhost:8080${NC}"
    echo -e "\n${YELLOW}💡 Tips:${NC}"
    echo -e "  - Code changes will hot-reload automatically"
    echo -e "  - View logs: ${BLUE}./dev.sh logs${NC}"
    echo -e "  - Stop: ${BLUE}./dev.sh stop${NC}"
    ;;
    
  stop)
    echo -e "${GREEN}Stopping development containers...${NC}"
    docker-compose -f docker-compose.dev.yml down
    echo -e "${GREEN}✅ Stopped${NC}"
    ;;
    
  restart)
    echo -e "${GREEN}Restarting development containers...${NC}"
    docker-compose -f docker-compose.dev.yml restart
    echo -e "${GREEN}✅ Restarted${NC}"
    ;;
    
  logs)
    echo -e "${GREEN}Showing logs (Ctrl+C to exit)...${NC}\n"
    docker-compose -f docker-compose.dev.yml logs -f
    ;;
    
  logs-web)
    echo -e "${GREEN}Showing web container logs (Ctrl+C to exit)...${NC}\n"
    docker-compose -f docker-compose.dev.yml logs -f web
    ;;
    
  build)
    echo -e "${GREEN}Rebuilding development image...${NC}"
    docker-compose -f docker-compose.dev.yml build web
    echo -e "${GREEN}✅ Build complete${NC}"
    ;;
    
  rebuild)
    echo -e "${GREEN}Rebuilding and restarting...${NC}"
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml build web
    docker-compose -f docker-compose.dev.yml up -d
    echo -e "${GREEN}✅ Rebuild complete${NC}"
    ;;
    
  reset-db)
    echo -e "${YELLOW}⚠️  Resetting database (all data will be lost)...${NC}"
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.dev.yml up -d
    echo -e "${GREEN}✅ Database reset complete${NC}"
    ;;
    
  migrate)
    echo -e "${GREEN}Running database migrations...${NC}"
    docker-compose -f docker-compose.dev.yml exec web npx prisma migrate deploy
    echo -e "${GREEN}✅ Migrations applied${NC}"
    ;;
    
  shell)
    echo -e "${GREEN}Opening shell in web container...${NC}"
    docker-compose -f docker-compose.dev.yml exec web zsh
    ;;
    
  *)
    echo -e "${BLUE}Usage: ./dev.sh [command]${NC}\n"
    echo "Commands:"
    echo "  start      - Start development environment (default)"
    echo "  stop       - Stop development environment"
    echo "  restart    - Restart containers"
    echo "  logs       - View all logs"
    echo "  logs-web   - View web container logs only"
    echo "  build      - Rebuild development image"
    echo "  rebuild    - Rebuild and restart everything"
    echo "  reset-db   - Reset database (WARNING: destroys all data)"
    echo "  migrate    - Run database migrations"
    echo "  shell      - Open shell in web container"
    ;;
esac


