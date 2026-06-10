server {
    listen 80;
    server_name openclaw.havedev.com;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:20400;
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

# Note: SSL akan ditambahkan otomatis oleh Certbot setelah menjalankan:
# sudo certbot --nginx -d openclaw.havedev.com --non-interactive --agree-tos -m admin@havedev.com
