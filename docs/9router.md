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

## Latest Verified State

Checked after live update on 2026-07-08:

| Item | Value |
|---|---|
| Image digest | `decolua/9router@sha256:33a314720b9d3c122bb402fe2f3de5fc9b7271e7e188258b3c543160c0bf496f` |
| Container image ID | `sha256:33a314720b9d3c122bb402fe2f3de5fc9b7271e7e188258b3c543160c0bf496f` |
| Container started at | `2026-07-08T07:18:xx` |
| Container status | `running`, restart count `0` |
| HTTP checks | local `307`, public `307` |
| Model catalog | `cx/gpt-5.5` present |
| Data backup created before update | `/opt/9router/data-backup-20260708-0718xx` |
| Image prune result | `Total reclaimed space: 112.8MB` |

## Common Operations

### Restart

```bash
cd /opt/9router
sudo docker compose restart
```

### Update to Latest Version

9Router is the active AI backend for Codex, Open WebUI, OpenClaw, and n8n on this VPS. Run the update when a short AI interruption is acceptable, and verify `/v1/models` before considering the update finished.

```bash
cd /opt/9router

# Backup SQLite/router state before replacing the container.
sudo cp -a /opt/9router/data /opt/9router/data-backup-$(date +%Y%m%d-%H%M%S)

sudo docker compose pull
sudo docker compose up -d

# Local web check. 200/307/401 means the service is responding.
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:20128

# Authenticated model check using the existing OpenClaw 9Router endpoint key.
KEY=$(sudo sed -n 's/^OPENAI_API_KEY=//p' /opt/openclaw/.env | tr -d '"' | tail -n 1)
curl -fsS http://127.0.0.1:20128/v1/models -H "Authorization: Bearer $KEY" \
  | tee /tmp/9router-models.json \
  | jq -r '.data[].id' \
  | grep -Fx 'cx/gpt-5.5'

curl -s -o /dev/null -w "%{http_code}\n" https://9router.havedev.com
sudo docker image prune -f   # Cleanup old image after verification
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

KEY=$(sudo sed -n 's/^OPENAI_API_KEY=//p' /opt/openclaw/.env | tr -d '"' | tail -n 1)
curl -fsS http://127.0.0.1:20128/v1/models -H "Authorization: Bearer $KEY" \
  | jq '{model_count: (.data | length), has_default_model: ([.data[].id] | contains(["cx/gpt-5.5"]))}'
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

## Security

### Login Brute-Force Protection

The dashboard login endpoint (`/api/auth/login`) is protected by three layers:

1. **Nginx IP blocklist** — Known attacker IPs are denied at the reverse proxy level (HTTP 403).
2. **Nginx per-IP rate limiting** — Login requests are limited to 5 per minute per IP (`limit_req_zone` with `zone=9router_login`). One attacker cannot exhaust the rate limit for other IPs.
3. **fail2ban auto-ban** — IPs that hit 5+ failed login attempts (401/429) within 10 minutes are banned via iptables for 1 hour.

Config files on the server:

| File | Purpose |
|---|---|
| `/etc/nginx/sites-enabled/9router.havedev.com` | `deny` directives + login `location` block with `limit_req` |
| `/etc/nginx/conf.d/9router-ratelimit.conf` | `limit_req_zone` definition (must be in `http` context) |
| `/etc/fail2ban/filter.d/9router-login.conf` | Regex filter matching failed login attempts in nginx logs |
| `/etc/fail2ban/jail.d/9router-login.conf` | Jail config: `maxretry=5`, `findtime=600`, `bantime=3600` |

### Block an Attacker IP

```bash
# Add IP to nginx blocklist
sudo nano /etc/nginx/sites-enabled/9router.havedev.com
# Add: deny <IP>;
sudo nginx -t && sudo systemctl reload nginx
```

### fail2ban Commands

```bash
# Check jail status
sudo fail2ban-client status 9router-login

# Manually ban an IP
sudo fail2ban-client set 9router-login banip <IP>

# Unban an IP (e.g. if you accidentally locked yourself out)
sudo fail2ban-client set 9router-login unbanip <IP>

# View all jails
sudo fail2ban-client status

# View fail2ban log
sudo tail -50 /var/log/fail2ban.log
```

### Known Blocked IPs

| IP | Origin | Reason | Date Blocked |
|---|---|---|---|
| `43.201.122.146` | AWS EC2 Seoul, Korea | Automated brute-force (668+ login attempts/day) | 2026-06-28 |

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

### Image Generation

9Router exposes image generation through the OpenAI-compatible endpoint:

```bash
http://9router:20128/v1/images/generations
```

#### Recommended Route Without OpenAI API Billing

Use the existing active `codex` OAuth credential in 9Router:

```text
codex/gpt-5.5-image
```

Live status checked on 2026-06-10: this route successfully generated one `b64_json` image from the VPS through 9Router. It does not require adding an OpenAI Platform API key, but it still depends on the active Codex account/entitlement already connected in 9Router.

Test from the VPS host:

```bash
KEY=$(sudo awk -F= '/^OPENAI_API_KEY=/{print $2}' /opt/openclaw/.env)
curl -sS http://127.0.0.1:20128/v1/images/generations \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"codex/gpt-5.5-image","prompt":"simple blue square icon","n":1,"size":"1024x1024","response_format":"b64_json"}' \
  | jq -r '.data[0].b64_json' \
  | base64 --decode > /tmp/9router-codex-image-test.png
```

For n8n article images, prefer this route first. Keep a no-key fallback such as Pollinations in the workflow for cases where the Codex route is rate-limited or temporarily unavailable.

#### OpenAI GPT Image Route

Use this model when the `openai` upstream credential is active in 9Router:

```text
gpt-image-2
```

Required dashboard setup:

1. Open `https://9router.havedev.com/dashboard`.
2. Add an upstream provider connection for `openai` with a valid OpenAI API key.
3. Keep the existing Endpoint API key for clients such as OpenClaw and n8n.

Live status checked on 2026-06-10: 9Router routes `gpt-image-2` to provider `openai`, but the VPS currently returns `No credentials for provider: openai` until that upstream provider connection is added.

Test OpenAI image generation from the VPS host:

```bash
KEY=$(sudo awk -F= '/^OPENAI_API_KEY=/{print $2}' /opt/openclaw/.env)
curl -sS http://127.0.0.1:20128/v1/images/generations \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-image-2","prompt":"simple blue square icon","n":1,"size":"1024x1024"}' \
  | jq -r '.data[0].b64_json' \
  | base64 --decode > /tmp/9router-openai-image-test.png
```

OpenAI GPT Image responses use `data[0].b64_json`; do not expect a hosted image URL from this endpoint.

#### OpenClaw Codex Route

OpenClaw currently uses the same 9Router route for image generation through the internal Docker endpoint.

Known working model route:

```text
codex/gpt-5.5-image
```

Configured OpenClaw fallback route:

```text
google/gemini-3.1-flash-image-preview
```

This fallback is routed through OpenClaw's `litellm` provider to 9Router as `litellm/google/gemini-3.1-flash-image-preview`. It will only work after a `google` upstream credential is added and activated in 9Router.

Test from the VPS host:

```bash
KEY=$(sudo awk -F= '/^OPENAI_API_KEY=/{print $2}' /opt/openclaw/.env)
curl -sS http://127.0.0.1:20128/v1/images/generations \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"codex/gpt-5.5-image","prompt":"simple blue square icon","n":1,"size":"1024x1024","response_format":"b64_json"}'
```

Notes:

- `256x256` is rejected by the Codex image route; use `1024x1024` or larger supported sizes.
- `gpt-image-2`, `gpt-image-1`, `dall-e-3`, and Google image routes require their own upstream credentials in 9Router. Without those credentials, 9Router returns `No credentials for provider: openai` or `No credentials for provider: google`.
