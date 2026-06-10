# Open WebUI (Open WebUI) — Setup & Maintenance

## Overview

Open WebUI adalah AI Chat Interface berbasis Open WebUI yang terhubung ke 9Router sebagai AI backend.

- **URL**: `https://chat-ai.havedev.com`
- **API Backend**: `https://9router.havedev.com/v1` (9Router)
- **Default Model**: `cx/gpt-5.5`

## Deployment Details

| Component | Value |
|---|---|
| Image | `ghcr.io/open-webui/open-webui:main` |
| Container name | `openwebui` |
| Internal port | `127.0.0.1:20200` → container `8080` |
| Data dir (host) | `/opt/openwebui/data` |
| Data dir (container) | `/app/backend/data` |
| Workspace (host) | `/opt/openwebui/workspace` |
| Workspace (container) | `/workspace` |
| Config dir | `/opt/openwebui/` |
| Log rotation | 10MB × 3 files |

## Common Operations

### Restart

```bash
cd /opt/openwebui
sudo docker compose restart
```

### Update to Latest Version

```bash
cd /opt/openwebui
sudo docker compose pull
sudo docker compose up -d
sudo docker image prune -f   # Cleanup old image
```

### View Logs

```bash
# Last 50 lines
docker logs openwebui --tail 50

# Follow live
docker logs openwebui -f

# Since 1 hour ago
docker logs openwebui --since 1h
```

### Check Status

```bash
docker ps --filter name=openwebui
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:20200
```

### Backup Data

```bash
# Data is stored in /opt/openwebui/data (SQLite DB + uploads)
sudo cp -r /opt/openwebui/data /opt/openwebui/data-backup-$(date +%Y%m%d)
```

### Restore Data

```bash
sudo docker compose down
sudo cp -r /opt/openwebui/data-backup-XXXXXXXX/* /opt/openwebui/data/
sudo docker compose up -d
```

## Environment Variables

File: `/opt/openwebui/.env`

| Variable | Description |
|---|---|
| `OPENAI_API_BASE_URL` | 9Router API endpoint (https://9router.havedev.com/v1) |
| `OPENAI_API_KEY` | API key from 9Router dashboard |
| `ENABLE_OLLAMA_API` | Ollama integration (disabled) |
| `WEBUI_NAME` | App display name (Open WebUI) |
| `WEBUI_URL` | Public URL |
| `GITHUB_TOKEN` | GitHub Personal Access Token for git push |
| `GITHUB_USERNAME` | GitHub username |

## AI Model Configuration

Open WebUI connects to 9Router which provides access to multiple AI models. The default model is:

```
Model: cx/gpt-5.5
Endpoint: https://9router.havedev.com/v1
```

To add or change models:
1. Go to **Admin Settings** → **Connections** → **OpenAI**
2. Verify the 9Router connection is active
3. Models from 9Router will auto-populate in the chat interface

## Git Operations

Open WebUI dilengkapi custom **Git Tool** yang memungkinkan AI melakukan operasi git langsung dari chat.

### Capabilities

- `git_clone` — Clone repo dari GitHub
- `git_status` / `git_diff` / `git_log` — Inspect repo
- `git_pull` — Pull latest changes
- `git_add_commit` — Stage + commit changes
- `git_push` — Push ke remote
- `git_branch` / `git_checkout` — Branch management
- `read_file` / `write_file` / `list_files` — File operations
- `list_repos` — List semua repos di workspace

### Workspace

Semua repos disimpan di `/workspace` (host: `/opt/openwebui/workspace`).

### Tool Code

Tool code disimpan di `configs/openwebui/git-tool.py` (reference copy).
Untuk install/update: copy-paste isi file ke **Workspace → Tools → Create/Edit Tool** di Open WebUI UI.

### Contoh Penggunaan (di chat)

```
Clone repo https://github.com/allfix53/my-project.git
Lihat file apa saja di repo my-project
Baca file README.md di repo my-project
Edit file index.html, tambahkan ...
Commit dengan pesan "fix: update header"
Push ke remote
```

## SSL Certificate

SSL via Let's Encrypt + Certbot.

### Generate (first time)

```bash
sudo certbot --nginx -d chat-ai.havedev.com --non-interactive --agree-tos -m admin@havedev.com
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
docker logs openwebui
docker inspect openwebui | grep -A5 State
```

### Port already in use

```bash
sudo lsof -i :20200
```

### 502 Bad Gateway

```bash
# Check if container is running
docker ps --filter name=openwebui

# Check if port is accessible
curl http://127.0.0.1:20200

# Check nginx config
sudo nginx -t
sudo systemctl reload nginx
```

### Models not showing up

```bash
# Check if 9Router is accessible from inside Open WebUI container
docker exec openwebui sh -lc 'curl -s -o /dev/null -w "%{http_code}\n" "$OPENAI_API_BASE_URL/models"'

# Check Open WebUI logs for connection errors
docker logs openwebui --tail 20 | grep -i "error\|fail"
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

## First-Time Setup

1. Open `https://chat-ai.havedev.com`
2. Create admin account (first user = admin)
3. Verify 9Router connection: **Admin Settings** → **Connections** → **OpenAI**
4. Select model `cx/gpt-5.5` in chat and test

## Setup Date

- Initial setup: 2026-06-03
