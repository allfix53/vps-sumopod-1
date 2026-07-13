# VPS vps-sumopod-1

Dokumentasi dan konfigurasi untuk VPS **vps-sumopod-1**.

## Server Info

| Property | Value |
|---|---|
| Server label | vps-sumopod-1 |
| OS hostname | `VM-0-205-ubuntu` |
| Public IP | `43.133.147.236` |
| Private IP | `10.11.0.205` |
| OS | Ubuntu 24.04.4 LTS |
| Disk | 60GB provisioned (`59G` root filesystem) |
| RAM | 3.6GB |
| SSH | `ssh ubuntu@43.133.147.236` |

## Installed Services

| Service | URL | Port | Status |
|---|---|---|---|
| 9Router | `https://9router.havedev.com` | 20128 | ✅ Running (updated 2026-07-13) |
| Open WebUI | `https://chat-ai.havedev.com` | 20200 | ✅ Running |
| OpenClaw Gateway | `https://openclaw.havedev.com` | 20400 | ✅ Running (`OpenClaw 2026.6.11`) |
| n8n | `https://n8n.havedev.com` | 20300 | ✅ Running |

### Future Services (planned)

- (lainnya)

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────┐
│  fail2ban                       │  ← auto-bans brute-force IPs via iptables
├─────────────────────────────────┤
│  Nginx (port 80/443)            │
│  SSL termination (Let's Encrypt)│
│  Reverse proxy                  │
│  Per-IP rate limiting (login)   │
├─────────────────────────────────┤
│                                 │
│  9router.havedev.com ──────────→│──→ 127.0.0.1:20128 (9Router)
│                                 │
│  chat-ai.havedev.com ─────────→│──→ 127.0.0.1:20200 (Open WebUI)
│                                 │
│  openclaw.havedev.com ─────────→│──→ 127.0.0.1:20400 (OpenClaw)
│                                 │
│  n8n.havedev.com ──────────────→│──→ 127.0.0.1:20300 (n8n)
│                                 │
│  (future services) ────────────→│──→ 127.0.0.1:xxxx  (Docker)
│                                 │
└─────────────────────────────────┘

         Open WebUI ──→ https://9router.havedev.com/v1 (9Router API)
         Model: cx/gpt-5.5

         OpenClaw ──→ http://9router:20128/v1 (internal Docker network)
         Provider: router9
         Default model: router9/cx/gpt-5.5
         Image generation: litellm/codex/gpt-5.5-image via 9Router
         Image fallback: litellm/google/gemini-3.1-flash-image-preview via 9Router
         n8n image route: codex/gpt-5.5-image via 9Router, with Pollinations fallback
         OpenAI image route: gpt-image-2 via 9Router (requires openai upstream credential)
```

## Quick Commands

```bash
# SSH ke VPS
ssh ubuntu@43.133.147.236

# Cek disk usage
diskcheck

# Cek running containers
docker ps

# Cek logs 9router
docker logs 9router --tail 50

# Restart 9router
cd /opt/9router && sudo docker compose restart

# Update 9router
# Note: Codex, Open WebUI, OpenClaw, and n8n consume AI through this router.
# Expect a short interruption while the container is recreated.
cd /opt/9router
sudo cp -a /opt/9router/data /opt/9router/data-backup-$(date +%Y%m%d-%H%M%S)
sudo docker compose pull
sudo docker compose up -d
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:20128
KEY=$(sudo sed -n 's/^OPENAI_API_KEY=//p' /opt/openclaw/.env | tr -d '"' | tail -n 1)
curl -fsS http://127.0.0.1:20128/v1/models -H "Authorization: Bearer $KEY" \
  | jq -r '.data[].id' | grep -Fx 'cx/gpt-5.5'
sudo docker image prune -f

# Cek logs Open WebUI
docker logs openwebui --tail 50

# Restart Open WebUI
cd /opt/openwebui && sudo docker compose restart

# Update Open WebUI
cd /opt/openwebui && sudo docker compose pull && sudo docker compose up -d && sudo docker image prune -f

# Cek logs OpenClaw
docker logs openclaw-gateway --tail 50

# Restart OpenClaw
cd /opt/openclaw && sudo docker compose restart

# Update OpenClaw package version
cd /opt/openclaw && sudo docker compose build --no-cache openclaw-gateway && sudo docker compose up -d openclaw-gateway

# Cek model catalog OpenClaw -> 9Router
docker exec openclaw-gateway openclaw models status
docker exec openclaw-gateway openclaw models list --json | jq -r '.models[].key | select(startswith("router9/"))'

# Test image generation OpenClaw -> 9Router
docker exec openclaw-gateway openclaw infer image generate \
  --prompt "simple blue square icon" \
  --size 1024x1024 \
  --count 1 \
  --output /tmp/openclaw-9router-image-test.png \
  --timeout-ms 180000

# Cek logs n8n
docker logs n8n --tail 50

# Restart n8n
cd /opt/n8n && sudo docker compose restart

# Update n8n
cd /opt/n8n && sudo docker compose pull && sudo docker compose up -d && sudo docker image prune -f

# Manual disk cleanup
bash /opt/scripts/disk-cleanup.sh

# --- fail2ban ---

# Check 9Router login jail status
sudo fail2ban-client status 9router-login

# View banned IPs
sudo fail2ban-client status 9router-login | grep 'Banned IP'

# Manually ban an IP
sudo fail2ban-client set 9router-login banip <IP>

# Unban an IP
sudo fail2ban-client set 9router-login unbanip <IP>
```

## Disk Management

Disk hanya 60GB. Safeguards yang sudah terpasang:

- Docker log rotation: max 10MB × 3 files per container
- Docker auto-prune: weekly cron (Sunday 3am, volumes preserved)
- Systemd journal: capped at 100MB
- 9Router request logs: disabled
- fail2ban logs: managed by logrotate (default)

## Directory Structure (VPS)

```
/opt/
├── 9router/
│   ├── .env                 # Environment config (secrets)
│   ├── docker-compose.yml   # Docker compose config
│   └── data/                # Persistent data (SQLite DB)
├── openwebui/
│   ├── .env                 # Environment config (secrets)
│   ├── docker-compose.yml   # Docker compose config
│   └── data/                # Persistent data (SQLite DB + uploads)
├── openclaw/
│   ├── .env                 # Environment config (secrets)
│   ├── docker-compose.yml   # Docker compose config
│   └── data/                # Persistent data mapped to /app/data
├── n8n/
│   ├── .env                 # Environment config (secrets)
│   ├── docker-compose.yml   # Docker compose config
│   └── data/                # Persistent data (workflows, credentials)
└── scripts/
    └── disk-cleanup.sh      # Manual cleanup script

/etc/fail2ban/
├── filter.d/
│   └── 9router-login.conf   # Custom filter for 9Router login brute-force
└── jail.d/
    └── 9router-login.conf   # Jail: ban after 5 fails in 10min, 1h ban

/etc/nginx/
├── conf.d/
│   └── 9router-ratelimit.conf  # Per-IP rate limit zone for login
└── sites-enabled/
    └── 9router.havedev.com     # IP blocklist + rate-limited login location
```

## Directory Structure (This Repo)

```
vps-sumopod-1/
├── README.md                           # This file
├── docs/
│   ├── 9router.md                      # 9Router setup details
│   ├── openwebui.md                     # Open WebUI setup details
│   ├── openclaw.md                     # OpenClaw Gateway setup details
│   └── n8n.md                          # n8n setup details
├── configs/
│   ├── 9router/
│   │   ├── docker-compose.yml          # Reference copy
│   │   └── .env.example               # Template (no secrets)
│   ├── openwebui/
│   │   ├── docker-compose.yml          # Reference copy
│   │   ├── .env.example               # Template (no secrets)
│   │   └── git-tool.py                # Open WebUI Git Tool reference
│   ├── openclaw/
│   │   ├── Dockerfile                 # OpenClaw image build reference
│   │   ├── docker-compose.yml          # Reference copy
│   │   └── .env.example               # Template (no secrets)
│   ├── n8n/
│   │   ├── docker-compose.yml          # Reference copy
│   │   ├── .env.example               # Template (no secrets)
│   │   └── n8n-article-workflow.json  # Inactive article workflow reference
│   └── nginx/
│       ├── 9router.havedev.com         # Nginx vhost config
│       ├── chat-ai.havedev.com        # Nginx vhost config
│       ├── openclaw.havedev.com        # Nginx vhost config
│       └── n8n.havedev.com             # Nginx vhost config
└── scripts/
    └── disk-cleanup.sh                 # Disk cleanup script
```

## Setup Date

- Initial setup: 2026-06-03
- Last VM sync audit: 2026-06-19
- Last 9Router live update: 2026-07-13; image digest `decolua/9router@sha256:35717c131f695106f62087bc5915f9ddba992ea32d58b0fb12790ab69def944a`; `cx/gpt-5.6-sol` was present.
