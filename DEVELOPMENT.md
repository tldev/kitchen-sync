# Development Setup

This guide explains how to run Kitchen Sync in development mode with hot reloading.

## Quick Start

```bash
# Start development environment
./dev.sh start

# View logs
./dev.sh logs

# Stop everything
./dev.sh stop
```

The app will be available at **http://localhost:3000**

## Features

- 🔥 **Hot Reloading**: Code changes are reflected instantly without rebuilding
- 📦 **Volume Mounts**: Source code is mounted from your local filesystem
- 🗄️ **Persistent Data**: Database and node_modules persist between restarts
- 📝 **Live Logs**: View logs from sync jobs in `calendarsync-data/logs/`

## Development Commands

| Command | Description |
|---------|-------------|
| `./dev.sh start` | Start development environment |
| `./dev.sh stop` | Stop all containers |
| `./dev.sh restart` | Restart containers |
| `./dev.sh logs` | View all logs (live) |
| `./dev.sh logs-web` | View web container logs only |
| `./dev.sh build` | Rebuild development image |
| `./dev.sh rebuild` | Rebuild and restart everything |
| `./dev.sh reset-db` | Reset database (⚠️ destroys all data) |
| `./dev.sh migrate` | Run database migrations |
| `./dev.sh shell` | Open shell in web container |

## What Gets Mounted?

The following directories are mounted for hot reloading:
- `app/` - Next.js app directory
- `components/` - React components
- `lib/` - Library code
- `prisma/` - Database schema and migrations
- Config files (next.config.js, tsconfig.json, etc.)

## Making Schema Changes

When you modify `prisma/schema.prisma`:

1. Create a migration:
   ```bash
   docker-compose -f docker-compose.dev.yml exec web npx prisma migrate dev --name your_migration_name
   ```

2. Or just regenerate the client:
   ```bash
   docker-compose -f docker-compose.dev.yml exec web npx prisma generate
   ```

## Viewing Sync Job Logs

Sync job logs are saved to `calendarsync-data/logs/{jobId}/{runId}.log` and are mounted from your local filesystem, so you can view them directly:

```bash
# View latest log
ls -lt calendarsync-data/logs/*/*.log | head -1 | xargs cat

# Tail a specific log
tail -f calendarsync-data/logs/{jobId}/{runId}.log
```

## Production Build

To build and run the production version:

```bash
# Stop dev environment
./dev.sh stop

# Start production
docker-compose up -d

# View logs
docker-compose logs -f
```

## Troubleshooting

### Container won't start
```bash
./dev.sh stop
./dev.sh rebuild
```

### Need to reset everything
```bash
./dev.sh stop
docker-compose -f docker-compose.dev.yml down -v
docker volume prune -f
./dev.sh start
```

### Changes not appearing
1. Check if container is running: `docker-compose -f docker-compose.dev.yml ps`
2. Check logs: `./dev.sh logs-web`
3. Try restarting: `./dev.sh restart`

### Port already in use
```bash
# Check what's using port 3000
lsof -i :3000

# Or use a different port by modifying docker-compose.dev.yml
```


