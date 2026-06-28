# Rate limit zone defined in /etc/nginx/conf.d/9router-ratelimit.conf:
#   limit_req_zone $binary_remote_addr zone=9router_login:10m rate=5r/m;

server {
    listen 80;
    listen 443 ssl;
    server_name 9router.havedev.com;

    ssl_certificate /etc/letsencrypt/live/9router.havedev.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/9router.havedev.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 10m;

    # Block known brute-force attacker IPs
    deny 43.201.122.146;

    # Rate limit login endpoint per-IP
    location /api/auth/login {
        limit_req zone=9router_login burst=3 nodelay;
        limit_req_status 429;

        proxy_pass http://127.0.0.1:20128;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:20128;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
