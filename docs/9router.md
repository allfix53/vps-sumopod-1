# 9Router — Setup & Maintenance

## Overview

9Router adalah AI Router & Token Saver yang menghubungkan AI coding tools (Claude Code, Cursor, Codex, dll) ke 40+ AI providers.

- **URL**: `https://9router.havedev.com`
- **Dashboard**: `https://9router.havedev.com/dashboard`
- **API Endpoint**: `https://9router.havedev.com/v1`
- **Default Password**: `change-me` (ganti segera setelah login!)

## Deployment Details

| Component | Value |
|---|---|
| Image | `decolua/9router:latest` |
| Container name | `9router` |
| Internal port | `127.0.0.1:20128` |
| Data dir (host) | `/opt/9router/data` |
| Data dir (container) | `/app/data` |
| Config dir | `/opt/9router/` |
| Log rotation | 10MB × 3 files |

## Common Operations

### Restart

```bash
cd /opt/9router
sudo docker compose restart
```

### Update to Latest Version

```bash
cd /opt/9router
sudo docker compose pull
sudo docker compose up -d
sudo docker image prune -f   # Cleanup old image
```

### View Logs

```bash
# Last 50 lines
docker logs 9router --tail 50

# Follow live
docker logs 9router -f

# Since 1 hour ago
docker logs 9router --since 1h
```

### Check Status

```bash
docker ps --filter name=9router
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:20128
```

### Backup Data

```bash
# Data is stored in /opt/9router/data (SQLite DB)
sudo cp -r /opt/9router/data /opt/9router/data-backup-$(date +%Y%m%d)
```

### Restore Data

```bash
sudo docker compose down
sudo cp -r /opt/9router/data-backup-XXXXXXXX/* /opt/9router/data/
sudo docker compose up -d
```

## Environment Variables

File: `/opt/9router/.env`

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret for JWT tokens (auto-generated) |
| `INITIAL_PASSWORD` | Dashboard login password |
| `DATA_DIR` | Data directory inside container |
| `PORT` | Listening port |
| `NODE_ENV` | Environment (production) |
| `API_KEY_SECRET` | API key encryption secret |
| `MACHINE_ID_SALT` | Machine ID salt |
| `ENABLE_REQUEST_LOGS` | Request logging (off for disk savings) |
| `AUTH_COOKIE_SECURE` | Secure cookie flag. Current VM value is `false`; re-test dashboard login before changing it. |
| `BASE_URL` | Public URL of 9Router |

## SSL Certificate

SSL via Let's Encrypt + Certbot.

### Generate (first time)

```bash
sudo certbot --nginx -d 9router.havedev.com --non-interactive --agree-tos -m admin@havedev.com
```

### Renew (auto via cron, manual if needed)

```bash
sudo certbot renew --dry-run   # Test
sudo certbot renew             # Actually renew
```

### Check Certificate

```bash
sudo certbot certificates
```

## Troubleshooting

### Container won't start

```bash
docker logs 9router
docker inspect 9router | grep -A5 State
```

### Port already in use

```bash
sudo lsof -i :20128
```

### 502 Bad Gateway

```bash
# Check if container is running
docker ps --filter name=9router

# Check if port is accessible
curl http://127.0.0.1:20128

# Check nginx config
sudo nginx -t
sudo systemctl reload nginx
```

### Disk full

```bash
# Check usage
df -h /
diskcheck

# Manual cleanup
bash /opt/scripts/disk-cleanup.sh

# Emergency: clear docker
docker system prune -af --volumes
```

## Connecting AI Tools

### Claude Code / Codex / Open WebUI

```
Endpoint: https://9router.havedev.com/v1
API Key: [copy from dashboard]
Model: cx/gpt-5.5  (or any model returned by /v1/models)
```

Current model list can be checked with:

```bash
curl -s https://9router.havedev.com/v1/models \
  -H "Authorization: Bearer $NINE_ROUTER_API_KEY" \
  | jq -r '.data[].id'
```

### Cursor / Cline / Others

Same endpoint and API key. Check 9Router dashboard for available models.
