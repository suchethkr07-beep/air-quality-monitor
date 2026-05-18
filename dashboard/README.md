# Air Quality Monitor Dashboard (Laptop + Mobile)

This is a **static** dashboard (HTML/CSS/JS) that reads your Firebase **Realtime Database** at:

- `/sensor/latest`

It works on:
- Laptop (open in a browser)
- Mobile (open in Chrome/Safari; you can “Add to Home screen”)

## 1) Set your Firebase config

Open `dashboard/app.js` and replace `firebaseConfig` with your values from:

Firebase Console → **Project settings** → **General** → **Your apps (Web)** → **Firebase SDK snippet (Config)**

## 2) Enable Anonymous auth

Firebase Console → **Authentication** → **Sign-in method** → enable **Anonymous**.

## 3) Make sure ESP8266 writes the right path

Your Arduino code should write a JSON object to:

- `/sensor/latest`

with keys like:
- `temperature_c`
- `humidity_pct`
- `gas_adc`
- `gas_volts`

## 4) Database rules (important)

If the page shows a DB permission error, update RTDB rules.

For testing only (open read/write):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Safer (only authenticated users; dashboard uses anonymous auth so this still works):

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## 5) Run it

### Option A: Simple local server (recommended)

From `C:\Users\rajat\Documents\New project`, run one:

- Python: `python -m http.server 5173`
- Node: `npx serve -l 5173`

Then open:
- `http://localhost:5173/dashboard/`

### Option B: Open the file directly

You can double-click `dashboard/index.html`, but some browsers block module imports in `file://` mode.
If it doesn’t load, use Option A.

## Mobile access

If you want to open it on your phone:

- Easiest: host it (Firebase Hosting / GitHub Pages / Netlify), then open the HTTPS link on mobile.
- If you want it only on your Wi‑Fi: run the local server and open `http://<your-laptop-ip>:5173/dashboard/` on your phone.

