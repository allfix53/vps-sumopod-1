# n8n Setup Guide

## Overview

n8n is a workflow automation tool deployed on vps-sumopod-1.

| Property | Value |
|---|---|
| URL | `https://n8n.havedev.com` |
| Internal Port | `127.0.0.1:20300` → `5678` (container) |
| Data Directory | `/opt/n8n/data` |
| Docker Image | `n8nio/n8n:latest` |
| Docker Network | `n8n_default` & `9router_default` |

## Installation Steps

### 1. DNS Setup

Pastikan DNS A record `n8n.havedev.com` mengarah ke `43.133.147.236`.

### 2. Create directory & config di VPS

```bash
sudo mkdir -p /opt/n8n/data
sudo chown -R 1000:1000 /opt/n8n/data
```

### 3. Copy config files ke VPS

```bash
# Dari local machine
scp configs/n8n/docker-compose.yml ubuntu@43.133.147.236:/tmp/
scp configs/n8n/.env.example ubuntu@43.133.147.236:/tmp/
scp configs/nginx/n8n.havedev.com ubuntu@43.133.147.236:/tmp/
```

### 4. Setup di VPS

```bash
ssh ubuntu@43.133.147.236

# Move docker-compose
sudo mv /tmp/docker-compose.yml /opt/n8n/
sudo cp /tmp/.env.example /opt/n8n/.env

# Edit .env - generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
sudo sed -i "s/your-encryption-key-here/$ENCRYPTION_KEY/" /opt/n8n/.env

# Set 9Router API access for workflows before activating any AI workflow
# OPENAI_API_BASE_URL should stay internal:
# OPENAI_API_BASE_URL=http://9router:20128/v1
# OPENAI_API_KEY should be copied from the 9Router dashboard/API key source.

# Setup nginx
sudo mv /tmp/n8n.havedev.com /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/n8n.havedev.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Start n8n
cd /opt/n8n && sudo docker compose up -d

# Setup SSL
sudo certbot --nginx -d n8n.havedev.com --non-interactive --agree-tos -m admin@havedev.com
```

### 5. Verify

```bash
# Cek container running
docker ps | grep n8n

# Cek logs
docker logs n8n --tail 50

# Test URL
curl -I https://n8n.havedev.com
```

## Management Commands

```bash
# Cek logs
docker logs n8n --tail 50

# Restart
cd /opt/n8n && sudo docker compose restart

# Update
cd /opt/n8n && sudo docker compose pull && sudo docker compose up -d && sudo docker image prune -f

# Stop
cd /opt/n8n && sudo docker compose down
```

## Disk Usage Notes

- Execution data auto-prune: 168 jam (7 hari)
- Log rotation: max 10MB × 3 files
- Data disimpan di `/opt/n8n/data`

## 9Router Workflow Notes

- n8n joins the external Docker network `9router_default` so workflows can call `http://9router:20128/v1` directly.
- Do not use `host.docker.internal` for 9Router from n8n on this VPS; it is not resolvable in the current n8n container.
- Keep article-generation workflows inactive until `OPENAI_API_KEY` is set and a `/v1/models` test returns HTTP 200 from inside the n8n container.
- For image generation without adding a paid OpenAI Platform API key, use 9Router model `codex/gpt-5.5-image`. This uses the existing active Codex OAuth credential in 9Router and returned `b64_json` successfully on 2026-06-10.
- Do not use `gpt-image-1-mini`, `gpt-image-1`, or `gpt-image-2` unless an upstream `openai` provider credential is added in 9Router. Those models currently return `No credentials for provider: openai` on this VPS.
- Keep the workflow fallback to Pollinations enabled so the article pipeline can still create an image when the Codex route is unavailable.
