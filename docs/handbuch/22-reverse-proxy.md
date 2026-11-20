# 22 · Reverse Proxy

PLICA spricht selbst kein TLS. Die App veröffentlicht nur ihren Port auf `127.0.0.1:3000` (`PLICA_BIND`, `PLICA_PORT`). Davor gehört ein Reverse Proxy auf demselben Server, der TLS übernimmt. In der Kanzlei ist das Caddy vor `https://plica.example.de`, zusammen mit authentik für die Anmeldung.

Setzen Sie hinter einem Proxy in `.env`:

```
TRUST_PROXY=true
```

## Was der Proxy leisten muss

- **TLS** terminieren und HTTP auf HTTPS umleiten. `APP_URL` (und ggf. `PUBLIC_URL`) beginnen mit `https://`.
- Den **`Host`-Header unverändert** weitergeben. PLICA unterscheidet daran Verwaltung und öffentliche Formulardomain.
- Die Client-Adresse an **`X-Forwarded-For` anhängen**.
- **Uploads** durchlassen: Die Body-Grenze muss etwas über `UPLOAD_MAX_MB` liegen (Standard 25 MB, also z. B. 30 MB).
- Die **Sicherheits-Header** von PLICA nicht überschreiben und keine eigenen `X-Frame-Options` oder CSP ergänzen.

## Caddy

Caddy holt und erneuert Zertifikate selbst, leitet HTTP auf HTTPS um, gibt den `Host`-Header weiter und setzt `X-Forwarded-For`. Mehr ist nicht nötig.

### Caddy auf dem Host

```caddyfile
plica.example.de {
	encode zstd gzip
	request_body {
		max_size 30MB
	}
	reverse_proxy 127.0.0.1:3000
}
```

### Caddy als Container

Läuft Caddy selbst in Docker, hängen Sie ihn an das Netz `web` von PLICA. Compose nennt es `plica_web` (Projektname `plica`). In der Compose-Datei von Caddy:

```yaml
services:
  caddy:
    # … Image, Ports 80/443, Volumes wie gewohnt
    networks: [plica_web]

networks:
  plica_web:
    external: true
```

Im Caddyfile steht dann der Dienstname statt der Loopback-Adresse:

```caddyfile
plica.example.de {
	encode zstd gzip
	request_body {
		max_size 30MB
	}
	reverse_proxy app:3000
}
```

Die Datenbank und der Objektspeicher bleiben im Netz `internal` und sind für Caddy nicht erreichbar.

## nginx

```nginx
server {
    listen 80;
    server_name plica.example.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name plica.example.de;

    ssl_certificate     /etc/letsencrypt/live/plica.example.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/plica.example.de/privkey.pem;

    client_max_body_size 30m;

    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP         $remote_addr;

    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

Bei nginx vor Version 1.25.1 schreiben Sie statt `http2 on;` die alte Form `listen 443 ssl http2;`. Die `proxy_set_header`-Zeilen auf Server-Ebene gelten für alle `location`-Blöcke, die selbst keine `proxy_set_header` setzen.

## Client-IP hinter dem Proxy

PLICA braucht die Client-Adresse nur für Ratenbegrenzung und die Sperre nach Fehlversuchen bei der Anmeldung. Gespeichert wird sie nie im Klartext, sondern nur als tagesgebundener Hash.

So ermittelt PLICA die Adresse:

1. Maßgeblich ist der **letzte** Eintrag in `X-Forwarded-For`. Ihn hängt Ihr eigener Proxy an (nginx: `$proxy_add_x_forwarded_for`, Caddy automatisch). Frühere Einträge kann ein Client frei setzen; sie zählen nicht.
2. Fehlt `X-Forwarded-For` ganz, nimmt PLICA bei `TRUST_PROXY=true` den Header `X-Real-IP`.

Daraus folgt:

- **Die App nie direkt ins Netz stellen.** Ohne vorgeschalteten Proxy könnte ein Client `X-Forwarded-For` selbst setzen und die Ratenbegrenzung umgehen. Lassen Sie `PLICA_BIND` auf `127.0.0.1`.
- **Genau ein Proxy.** Steht vor Ihrem Proxy noch ein weiterer (z. B. ein CDN oder ein zweiter Proxy), ist der letzte Eintrag dessen Adresse. Dann teilen sich alle Besucher eine Ratenbegrenzung, etwa 20 Anmeldeversuche pro Minute. Vermeiden Sie diese Kette oder sorgen Sie dafür, dass der letzte Eintrag wieder die echte Client-Adresse ist.

## Eigene Domain für öffentliche Formulare

Mit `PUBLIC_URL` trennen Sie öffentliche Formulare von der Verwaltung, etwa:

```
APP_URL=https://plica.kanzlei.de
PUBLIC_URL=https://formulare.kanzlei.de
```

Beide Namen zeigen auf dieselbe App. Formularlinks, QR-Codes, Fortsetzungslinks und der Einbettungscode verwenden dann `PUBLIC_URL`.

Auf der öffentlichen Domain beantwortet PLICA nur diese Pfade (festgelegt in `src/proxy.ts`):

| Pfad | Inhalt |
|---|---|
| `/f/…` | Formulare |
| `/r/…` | Fortsetzungslinks |
| `/api/public/…` | Absenden, Uploads, Bilder der Formulare |
| `/embed.js` | Skript für die Einbettung |
| `/_next/…` | Skripte, Stile, Schriften |
| `/favicon…` | Symbol |
| `/healthz` | Gesundheitsprüfung |

Jeder andere Pfad – Anmeldung, Verwaltung, `/api/v1` – antwortet dort mit **404**. Umgekehrt bleiben Formulare auch unter `APP_URL` erreichbar.

Die Trennung greift nur, wenn der `Host`-Header genau dem Host aus `PUBLIC_URL` entspricht. Caddy gibt ihn unverändert weiter, bei nginx sorgt `proxy_set_header Host $host;` dafür.

```caddyfile
formulare.kanzlei.de {
	request_body {
		max_size 30MB
	}
	reverse_proxy 127.0.0.1:3000
}

plica.kanzlei.de {
	reverse_proxy 127.0.0.1:3000
}
```

## Verwaltung nur intern erreichbar machen

Die Verwaltung muss nicht aus dem Internet erreichbar sein. Erreichbar sein müssen sie nur:

- die Browser der Mitarbeitenden (Oberfläche, Einladungs- und Freigabelinks, Rücksprung von authentik nach `/api/auth/oidc/callback`),
- Systeme, die die REST-API unter `/api/v1` nutzen, etwa j-lawyer.

authentik ruft PLICA nicht von sich aus auf. PLICA spricht ausgehend mit authentik; der Rücksprung nach der Anmeldung läuft über den Browser. Eine Sperre auf interne Adressen verträgt sich also mit SSO. Für das Homeoffice brauchen Mitarbeitende dann VPN.

### Mit getrennter Domain

Sperren Sie die Domain aus `APP_URL` für alle Adressen außer dem Kanzleinetz:

```caddyfile
plica.kanzlei.de {
	@extern not remote_ip private_ranges 203.0.113.10
	respond @extern 403
	reverse_proxy 127.0.0.1:3000
}
```

`private_ranges` steht für die privaten IPv4- und IPv6-Bereiche; `203.0.113.10` ist ein Platzhalter für die feste Adresse Ihres Büroanschlusses.

### Mit einer Domain

Läuft alles unter einer Adresse wie `plica.example.de`, lassen Sie die öffentlichen Pfade durch und sperren den Rest:

```caddyfile
plica.example.de {
	encode zstd gzip
	request_body {
		max_size 30MB
	}
	@verwaltung_extern {
		not path /f/* /r/* /api/public/* /embed.js /_next/* /favicon* /healthz
		not remote_ip private_ranges 203.0.113.10
	}
	respond @verwaltung_extern 403
	reverse_proxy 127.0.0.1:3000
}
```

Mit nginx:

```nginx
# öffentliche Pfade
location ~ ^/(f/|r/|api/public/|embed\.js$|_next/|favicon|healthz$) {
    proxy_pass http://127.0.0.1:3000;
}

# alles andere nur intern
location / {
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    allow 203.0.113.10;
    deny  all;
    proxy_pass http://127.0.0.1:3000;
}
```

Die Pfadliste muss zu `src/proxy.ts` passen. Prüfen Sie sie nach Updates.

## Sicherheits-Header

PLICA setzt die Sicherheits-Header selbst:

| Header | Wert |
|---|---|
| `Content-Security-Policy` | Seiten: strikte Richtlinie mit Nonce je Anfrage. API: `default-src 'none'; frame-ancestors 'none'; sandbox` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`, sobald `APP_URL` mit `https://` beginnt |
| `X-Frame-Options` | `DENY` – außer für `/f/…` und `/r/…`, deren Einbettung `EMBED_ORIGINS` steuert |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` auf öffentlichen Pfaden, sonst `same-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Robots-Tag` | `noindex, nofollow` auf öffentlichen Pfaden |
| `Cache-Control` | `no-store` für die API (außer Formularbildern) |

Der Proxy muss nichts ergänzen. Fügen Sie vor allem kein eigenes `X-Frame-Options` und keine zweite CSP hinzu: Eingebettete Formulare würden sonst blockiert, und zwei CSP-Header gelten gemeinsam, also strenger als beabsichtigt.

## Prüfen

```bash
curl -s https://plica.example.de/healthz
curl -sI https://plica.example.de/login | grep -iE 'strict-transport|content-security|x-frame'
```

Die erste Zeile sollte `"status":"ok"` enthalten, die zweite die drei Header zeigen. Mit `PUBLIC_URL` zusätzlich prüfen, dass die Verwaltung auf der öffentlichen Domain 404 liefert:

```bash
curl -so /dev/null -w '%{http_code}\n' https://formulare.kanzlei.de/login
```

← [Konfiguration](21-konfiguration.md) · weiter: [Sicherung](23-sicherung.md) →
