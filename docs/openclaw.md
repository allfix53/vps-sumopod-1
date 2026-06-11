# OpenClaw Gateway — Setup & Maintenance

## Overview

OpenClaw Gateway adalah core websocket server yang menghubungkan aplikasi *messaging* (seperti Slack, WhatsApp, dll) dengan AI Backend (seperti 9Router). 

- **URL**: `https://openclaw.havedev.com`
- **Internal Port**: `127.0.0.1:20400`

## Deployment Details

| Component | Value |
|---|---|
| Container name | `openclaw-gateway` |
| Internal port | `127.0.0.1:20400` |
| Config dir (host) | `/opt/openclaw/` |
| Persistent Data | `/opt/openclaw/data/` (mapped to `/app/data` in container) |
| Runtime version | `OpenClaw 2026.6.5 (5181e4f)`; updated 2026-06-11 |
| Log rotation | 10MB × 3 files |
| Docker Network | `openclaw_default` & `9router_default` |

## Environment Variables (`.env`)

The configuration is heavily dependent on environment variables stored in `/opt/openclaw/.env`.

Key Variables:
```env
OPENCLAW_GATEWAY_TOKEN=your_secure_password      # Used to login to Control UI
OPENAI_API_BASE_URL=http://9router:20128/v1      # Connected via internal docker network
OPENAI_API_KEY=sk-...                            # 9Router API Key
```
*Note: Any changes to `.env` require recreating the container using `docker compose up -d`.*

## Important Configuration & Troubleshooting

### 1. CORS / Allowed Origins Error
By default, OpenClaw blocks unknown domains. If you get an `Origin browser tidak diizinkan` error when accessing the Control UI:
```bash
sudo docker exec openclaw-gateway openclaw config set gateway.controlUi.allowedOrigins '["https://openclaw.havedev.com"]' --strict-json
sudo docker compose -f /opt/openclaw/docker-compose.yml restart
```

### 2. Device Pairing Approval
Every time a new browser connects (or after the container is completely recreated via `up -d`), it needs pairing approval.
1. List pending pairing requests:
   ```bash
   sudo docker exec openclaw-gateway openclaw devices list
   ```
2. Approve the specific request ID (often there are two: initial pairing + scope upgrade):
   ```bash
   sudo docker exec openclaw-gateway openclaw devices approve <REQUEST_ID>
   ```

### 3. Internal Network Connection to 9Router
OpenClaw communicates directly with 9Router using Docker's internal networking (`9router_default` network).
This avoids roundtrips over the public internet and prevents `Bad Gateway` or routing issues.

### 4. 9Router Model Catalog
OpenClaw is configured with an internal model provider id named `router9` because OpenClaw provider IDs must start with a letter.

- Provider base URL: `http://9router:20128/v1`
- Provider auth: `OPENAI_API_KEY` from the OpenClaw container environment
- Default model: `router9/cx/gpt-5.5`
- Model catalog source: live 9Router `/v1/models`, exposed in OpenClaw as `router9/<9router-model-id>`
- Current synced catalog: 30 models, checked 2026-06-11 after syncing disabled Gemini models from 9Router

### 5. Image Generation via 9Router
OpenClaw image generation is configured as an OpenAI-compatible image provider using OpenClaw's `litellm` provider wrapper, but the base URL points to 9Router on the internal Docker network.

- Provider base URL: `http://9router:20128/v1`
- Provider auth: `OPENAI_API_KEY` from the OpenClaw container environment
- Image generation model: `litellm/codex/gpt-5.5-image`
- Image generation fallback: `litellm/google/gemini-3.1-flash-image-preview`
- 9Router upstream route: `codex/gpt-5.5-image`
- OpenAI GPT Image route through 9Router: `gpt-image-2` (`litellm/gpt-image-2` from OpenClaw if it is made primary)
- Minimum tested size: `1024x1024` (`256x256` is rejected by the Codex image route)

Current config:

```json
{
  "primary": "litellm/codex/gpt-5.5-image",
  "fallbacks": [
    "litellm/google/gemini-3.1-flash-image-preview"
  ],
  "timeoutMs": 180000
}
```

The Gemini fallback still requires an active `google` upstream credential in 9Router. Without it, 9Router returns `No credentials for provider: google`; the Codex primary route remains the working default.

The OpenAI GPT Image route requires an active `openai` upstream credential in 9Router. Live status checked on 2026-06-10: `gpt-image-2` is routed to provider `openai`, but the VPS currently returns `No credentials for provider: openai` until that upstream connection is added.

Verify image generation:
```bash
sudo docker exec openclaw-gateway openclaw config get agents.defaults.imageGenerationModel
sudo docker exec openclaw-gateway openclaw infer image providers | grep '"id":"litellm"'
sudo docker exec openclaw-gateway openclaw infer image generate \
  --prompt "simple blue square icon" \
  --size 1024x1024 \
  --count 1 \
  --output /tmp/openclaw-9router-image-test.png \
  --timeout-ms 180000
```

If this config changes, restart only OpenClaw:
```bash
cd /opt/openclaw
sudo docker compose restart openclaw-gateway
```

Do not restart 9Router for this OpenClaw-side config change. 9Router should remain up and continue serving text/API traffic.

Verify after any OpenClaw config or 9Router model changes:
```bash
sudo docker exec openclaw-gateway openclaw config validate
sudo docker exec openclaw-gateway openclaw models status
sudo docker exec openclaw-gateway openclaw models list --json \
  | jq -r '.models[].key | select(startswith("router9/"))'
```

Do not restart 9Router when refreshing this catalog. Fetch `/v1/models`, patch OpenClaw config, then restart only `openclaw-gateway`.

## Common Operations

### Restart (Safe, preserves pairings and configs)
```bash
cd /opt/openclaw
sudo docker compose restart
```

### Recreate Container (Required when updating `.env` or `docker-compose.yml`)
> **WARNING**: Confirm `/opt/openclaw/data` contains the active `/app/data` contents before recreating. If persistence is correct, pairings and config should survive; if the data directory is empty or stale, re-run the CORS config and Device Pairing commands afterwards.
```bash
cd /opt/openclaw
sudo docker compose up -d
```

### Update to Latest Version
```bash
cd /opt/openclaw
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR=/opt/backups/openclaw-version-update-$TS
sudo mkdir -p "$BACKUP_DIR"
sudo cp docker-compose.yml Dockerfile .env .env.example "$BACKUP_DIR/"
sudo tar -C /opt/openclaw -czf "$BACKUP_DIR/data.before.tgz" data

sudo docker compose build --no-cache openclaw-gateway
sudo docker compose up -d openclaw-gateway
docker exec openclaw-gateway openclaw --version
```

This service uses a locally built image from `/opt/openclaw/Dockerfile`; `docker compose pull` does not update the `openclaw` npm package. Rebuild with `--no-cache` so `npm install -g openclaw@latest` is executed again.

After a version update, re-check the 9Router model catalog and sync `models.providers.router9.models` if the live `/v1/models` list has changed. Restart only `openclaw-gateway`; never restart 9Router for an OpenClaw-side catalog refresh.

### View Logs
```bash
docker logs openclaw-gateway --tail 50
```

## SSL Certificate

SSL is managed via Let's Encrypt + Nginx proxy. Cloudflare is used in front.
```bash
sudo certbot --nginx -d openclaw.havedev.com --non-interactive --agree-tos -m admin@havedev.com
```
