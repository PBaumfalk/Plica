# 22 · Reverse Proxy

PLICA veröffentlicht nur den App-Port auf `127.0.0.1:3000`. TLS übernimmt ein Reverse Proxy auf demselben Server. Setzen Sie in `.env` `TRUST_PROXY=true`.

## Caddy (empfohlen, automatisches TLS)

```caddyfile
plica.kanzlei.de {
	encode zstd gzip
	request_body {
		max_size 30MB
	}
	reverse_proxy 127.0.0.1:3000
}
```

### Eigene Domain für öffentliche Formulare

Mit `PUBLIC_URL=https://formulare.kanzlei.de` sind auf dieser Domain nur Formulare (`/f/…`, `/r/…`), deren API und Ressourcen erreichbar; jede Verwaltungsseite antwortet mit 404. So können Sie die Verwaltung zusätzlich auf das Kanzleinetz beschränken:

```caddyfile
formulare.kanzlei.de {
	reverse_proxy 127.0.0.1:3000
}

plica.kanzlei.de {
	@extern not remote_ip 203.0.113.0/24 10.0.0.0/8
	respond @extern 403
	reverse_proxy 127.0.0.1:3000
}
```

## nginx

```nginx
server {
    listen 443 ssl http2;
    server_name plica.kanzlei.de;
    ssl_certificate     /etc/letsencrypt/live/plica.kanzlei.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/plica.kanzlei.de/privkey.pem;

    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

`client_max_body_size` sollte etwas über `UPLOAD_MAX_MB` liegen. Der `Host`-Header muss erhalten bleiben, damit die Trennung von `APP_URL` und `PUBLIC_URL` greift.

## Sicherheits-Header

PLICA setzt Content-Security-Policy (mit Nonce), HSTS (bei `https://`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` und `X-Frame-Options` selbst. Der Proxy muss sie nicht ergänzen und sollte sie nicht überschreiben.

← [Konfiguration](21-konfiguration.md) · weiter: [Sicherung](23-sicherung.md) →
