# Dharna Chowk Chalo

A multiplayer satire game on a cartoon map of central New Delhi. Andolankari start somewhere within 1 km of Jantar Mantar, grow a kafila on the way, break the police barricades and hold the dharna on Jantar Mantar Road. Police players use the lathi, tear gas and the bus to stop them. AI kafilas and AI constables fill in whenever there are not enough people online.

- Works on phones (touch joystick + thumb buttons, auto low-graphics mode) and computers (mouse or WASD).
- One small Node.js server runs everything: it serves the game page and hosts the live rooms.
- Up to 40 human players per room. Rooms are created automatically; private rooms use an invite link (`?room=yourcode`).
- Practice offline works with no server at all.

```
server.js                 game server (static files + WebSocket rooms)
public/index.html         game page
public/style.css
public/client.js          drawing, input, networking
public/shared/map.js      the Delhi map (roads, landmarks, barricades, walkable area)
public/shared/sim.js      game rules; runs on the server, and in the browser for offline practice
Dockerfile, render.yaml, ecosystem.config.js, deploy/nginx.conf   deployment helpers
```

## Controls

| | Andolankari | Police |
|---|---|---|
| Walk | Mouse pointer or arrow keys (phone: joystick) | same |
| Click | NAARA | LATHI |
| W | NAARA | CALL backup constable |
| A | PUSH barricade (hold) | GAS at the mouse pointer (also right-click) |
| S | CHHUDAO (free a prisoner) | DRAG a protester / put them in the van |
| E | CHHUDAO | BARRIER (put up or repair a barricade) |
| D or Space | DASH | DASH |

Rules:
- **Tear gas:** police start with 5 shells. Every 5 people hit with the lathi earn 3 more. One shell scatters up to 5 people from a crowd; a shell that lands on a single person leaves them dizzy for 10 seconds.
- **Backup:** every 10 people a police player hits earn one backup constable (squad of up to 5).
- **Vans:** police vans roam the roads. A van stops for 10 seconds when a policeman brings a prisoner close, holds 5 prisoners, then drives to the thana. A crowd of 5+ around a van blocks it; 5 andolankari at a van unlock it and free one prisoner; 10 andolankari tip it over and free everyone.
- **Barricades:** it takes 10+ andolankari to break a barricade. 5 police together can repair a broken one or put up a new one across a road.
- **Crowds vs police:** 10 andolankari around a policeman push him out (players get knocked down). Every 10 people shouting a naara together leave one policeman dizzy. 5 andolankari around a policeman who is dragging someone free that person.

---

## 1. Run it on your own computer (5 minutes)

1. Install Node.js 18 or newer from https://nodejs.org
2. In this folder run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000 in two browser windows, pick different teams, and press **Play online**. Both windows are now in the same live game.
4. To test on your phone on the same Wi-Fi, find your computer's local IP (for example `192.168.1.20`) and open `http://192.168.1.20:3000` on the phone.

---

## 2. Put it on the internet

You need a host that keeps a Node.js process running and supports WebSockets. Pick one option.

### Option A — Render (easiest, no server admin)

1. Create a free GitHub account and upload this folder as a new repository.
2. Sign up at https://render.com, choose **New → Blueprint**, and select the repository. Render reads `render.yaml` and builds it.
3. When it finishes you get an address like `https://dharna-chowk-chalo.onrender.com`. Open it and play; share it with friends.
4. Keep it on a paid instance for a public game. Free instances go to sleep when idle, and the first visitor then waits about a minute while it wakes.
5. To use your own domain: in Render open the service → **Settings → Custom Domains**, add `play.yourdomain.com`, then create the CNAME record Render shows you at your domain registrar. Render issues the HTTPS certificate for you.

Railway (https://railway.app) works the same way: **New Project → Deploy from GitHub repo**. It detects `npm start`. Add the env var `TRUST_PROXY=1`.

### Option B — Your own VPS (cheapest at scale, best latency for India)

Use a small Linux server close to your players, for example DigitalOcean Bangalore or AWS Lightsail Mumbai (1 vCPU, 1 GB RAM is enough to start).

```bash
# on the server (Ubuntu)
sudo apt update && sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2

git clone https://github.com/<you>/dharna-chowk-chalo.git && cd dharna-chowk-chalo
npm ci --omit=dev
pm2 start ecosystem.config.js && pm2 save && pm2 startup     # keeps the game running after reboots

sudo cp deploy/nginx.conf /etc/nginx/sites-available/dharna-chowk
sudo nano /etc/nginx/sites-available/dharna-chowk           # change play.example.com to your domain
sudo ln -s /etc/nginx/sites-available/dharna-chowk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d play.yourdomain.com                  # free HTTPS
```

At your domain registrar, add an **A record** for `play` pointing to the server's IP address before running certbot.

To update the game later: `git pull && pm2 restart all`.

### Option C — Docker (any cloud that runs containers)

```
docker build -t dharna-chowk .
docker run -d -p 3000:3000 -e TRUST_PROXY=1 --restart unless-stopped dharna-chowk
```

Put it behind any HTTPS proxy or load balancer that passes WebSocket upgrades for the `/ws` path.

---

## 3. Add it to your existing website

Pick whichever matches your site.

**Link or button (simplest).** Host the game at `play.yourdomain.com` (section 2) and link to it from your site. On phones the game opens full screen.

**Embed on a page.** Paste this where the game should appear:

```html
<iframe src="https://play.yourdomain.com" title="Dharna Chowk Chalo"
        style="width:100%;height:80vh;border:0;border-radius:8px"
        allow="fullscreen; autoplay; screen-wake-lock"></iframe>
```

For phones, also add a plain link to open the game in its own tab; touch games play better outside an iframe.

**Serve the game files from your own website host** (for example if your site is on Netlify, Vercel, GitHub Pages or cPanel hosting, which cannot run the Node server). Upload the contents of `public/` there, run the server somewhere else (section 2), and set its address near the top of `public/index.html`:

```html
<script> window.DCC_SERVER = 'wss://play.yourdomain.com/ws'; </script>
```

Then on the server set `ALLOWED_ORIGINS=https://www.yourdomain.com` so only your site can connect.

---

## 4. Settings (environment variables)

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `ROOM_CAP` | `40` | Human players per room before a new room opens |
| `ROUND_SECONDS` | `300` | Length of one round |
| `MAX_PER_IP` | `8` | Connections allowed from one IP address (families and offices share IPs; raise it if needed) |
| `TRUST_PROXY` | off | Set to `1` when running behind Nginx, Render, Railway or a load balancer, so per-IP limits see the real visitor |
| `ALLOWED_ORIGINS` | any | Comma-separated list of websites allowed to connect, e.g. `https://play.yourdomain.com,https://www.yourdomain.com` |

Useful addresses on your server: `/health` returns `ok` for uptime monitors, and `/stats` shows rooms and player counts.

---

## 5. How many people can play at once

Measured on this build: 120 simulated players in three full rooms used about a third of one CPU core and about 15 KB/s of bandwidth per player.

- **One 1 vCPU server**: plan for roughly 200–250 players online at the same time (5–6 full rooms).
- **Bandwidth**: about 15 KB/s per active player, so 200 players need about 25 Mbit/s while they play. Check your host's monthly transfer allowance.
- **Going bigger**: one Node process uses one CPU core. On a VPS with more cores, uncomment the second app in `ecosystem.config.js` (port 3002) and the second `server` line in `deploy/nginx.conf`. Nginx keeps every private room on one process and spreads public players across processes. Add more processes the same way.
- Host the server in or near India (Bangalore, Mumbai or Singapore) so the game feels responsive for Indian players.

---

## 6. Changing the game

- **Map**: `public/shared/map.js`. Positions are metres east/north of Jantar Mantar. Roads (`ROADS`), open areas (`PLAZAS`), landmarks (`LANDMARKS`) and police barricades (`BARDEFS`) are plain lists. The map is a simplified cartoon, not survey-accurate; adjust anything that looks off to you.
- **Rules and balance**: `public/shared/sim.js` — dharna speed, lathi strength, crowd size that knocks police over, number of AI kafilas and constables (`balance()`), kafila names (`AI_NAMES`), slogans (`SLOGANS`).
- **Look of characters and buildings**: `public/client.js` (`drawPerson`, `buildBG`).

After any change, restart the server (`pm2 restart all` on a VPS; Render and Railway redeploy on each GitHub push).

---

Satire. Every kafila, slogan and player name is fictional. The map is a cartoon of real streets and public landmarks for setting only.
