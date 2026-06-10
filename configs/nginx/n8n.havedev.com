server {
    server_name n8n.havedev.com;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:20300;
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

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/n8n.havedev.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/n8n.havedev.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

# Note: SSL akan ditambahkan otomatis oleh Certbot setelah menjalankan:
# sudo certbot --nginx -d n8n.havedev.com --non-interactive --agree-tos -m admin@havedev.com
server {
    if ($host = n8n.havedev.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name n8n.havedev.com;
    return 404; # managed by Certbot


}