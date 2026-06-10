FROM node:24-bullseye-slim

WORKDIR /app

# Install openclaw globally
RUN npm install -g openclaw@latest

# OpenClaw stores its data in ~/.openclaw by default.
# We map it to /app/data for persistence.
ENV OPENCLAW_HOME=/app/data

# Ensure data directory exists
RUN mkdir -p /app/data

# Expose default websocket port
EXPOSE 18789

# Run the gateway
CMD ["openclaw", "gateway", "run", "--allow-unconfigured"]
