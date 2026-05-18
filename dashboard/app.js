import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9yOS1ke6SGirD32FPw09sOURHFmn9u_g",
  authDomain: "air-quality-monitor-79433.firebaseapp.com",
  databaseURL: "https://air-quality-monitor-79433-default-rtdb.firebaseio.com",
  projectId: "air-quality-monitor-79433",
  appId: "1:55132990146:web:4cd66cdf7d07e898abe95b",
};

const PRIMARY_PATH = "/sensor/latest";
const FALLBACK_PATH = "/sensor";

const el = (id) => document.getElementById(id);
const statusDot = el("statusDot");
const statusText = el("statusText");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorFromSeverity(severity) {
  const safe = [53, 166, 101];
  const bad = [130, 16, 25];
  const t = clamp(severity, 0, 1);
  const r = Math.round(lerp(safe[0], bad[0], t));
  const g = Math.round(lerp(safe[1], bad[1], t));
  const b = Math.round(lerp(safe[2], bad[2], t));
  return { r, g, b };
}

function rgbText(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function formatOne(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return "--";
  return number.toFixed(1);
}

function formatInt(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return "--";
  return String(Math.round(number));
}

function setStatus(kind, text) {
  statusDot.dataset.kind = kind;
  statusText.textContent = text;
}

function scoreTemperature(temp) {
  if (temp < 25) return 0.1;
  if (temp < 30) return 0.35;
  if (temp < 38) return 0.7;
  return 1;
}

function labelTemperature(temp) {
  if (temp < 25) return "Normal";
  if (temp < 30) return "Warm";
  if (temp < 38) return "Hot";
  return "Danger";
}

function scoreHumidity(humidity) {
  if (humidity < 25) return 0.6;
  if (humidity <= 60) return 0.1;
  if (humidity <= 80) return 0.65;
  return 1;
}

function labelHumidity(humidity) {
  if (humidity < 25) return "Very Dry";
  if (humidity <= 60) return "Comfortable";
  if (humidity <= 80) return "Humid";
  return "Very Humid";
}

function scoreAqi(aqi) {
  if (aqi <= 100) return 0.1;
  if (aqi <= 200) return 0.45;
  if (aqi <= 300) return 0.75;
  return 1;
}

function labelAqi(aqi) {
  if (aqi <= 100) return "Good";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Unhealthy";
  return "Hazardous";
}

function updateMetricCard(cardId, stateId, severity, stateText) {
  const card = el(cardId);
  const state = el(stateId);
  const metricColor = colorFromSeverity(severity);
  card.style.setProperty("--metric-color", rgbText(metricColor));
  card.style.setProperty("--metric-border", `rgba(${metricColor.r}, ${metricColor.g}, ${metricColor.b}, 0.42)`);
  card.style.setProperty("--metric-bg", `rgba(${metricColor.r}, ${metricColor.g}, ${metricColor.b}, 0.13)`);
  state.textContent = stateText;
}

function render(data) {
  const temperature = Number(
    data.temperature_c ?? data.temperature ?? data.temp_c ?? data.temp
  );
  const humidity = Number(
    data.humidity_pct ?? data.humidity ?? data.hum
  );
  const gasAdc = Number(
    data.gas_adc ?? data.aqi ?? data.gas ?? data.mq_adc
  );

  el("tempVal").textContent = formatOne(temperature);
  el("humVal").textContent = formatOne(humidity);
  el("gasVal").textContent = formatInt(gasAdc);
  el("updatedAt").textContent = new Date().toLocaleString("en-IN");

  updateMetricCard("tempCard", "tempState", scoreTemperature(temperature), labelTemperature(temperature));
  updateMetricCard("humCard", "humState", scoreHumidity(humidity), labelHumidity(humidity));
  updateMetricCard("gasCard", "gasState", scoreAqi(gasAdc), labelAqi(gasAdc));

}

function validateConfig() {
  const required = ["apiKey", "databaseURL", "projectId", "appId"];
  const missing = required.filter((key) => {
    const value = firebaseConfig[key];
    return !value || String(value).includes("PASTE_");
  });
  if (missing.length > 0) {
    setStatus("err", "Add Firebase config in app.js");
    throw new Error(`Missing firebase config keys: ${missing.join(", ")}`);
  }
}

async function start() {
  validateConfig();
  setStatus("busy", "Connecting");
  el("projectId").textContent = firebaseConfig.projectId;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setStatus("busy", "Signing in");
    }
  });

  let gotPrimaryData = false;

  onValue(
    ref(db, PRIMARY_PATH),
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        if (!gotPrimaryData) {
          setStatus("warn", "No data at /sensor/latest, checking /sensor");
        }
        return;
      }
      gotPrimaryData = true;
      setStatus("ok", "Live");
      render(data);
    },
    (error) => {
      setStatus("err", `DB error: ${error.code || "unknown"}`);
    }
  );

  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.warn("Anonymous sign-in failed, continuing with DB listener:", error);
    if (statusText.textContent !== "Live") {
      setStatus("warn", "Auth failed; reading without auth");
    }
  }

  onValue(
    ref(db, FALLBACK_PATH),
    (snapshot) => {
      if (gotPrimaryData) return;
      const data = snapshot.val();
      if (!data || typeof data !== "object") return;

      // If /sensor contains nested latest, prefer it.
      const candidate = data.latest && typeof data.latest === "object" ? data.latest : data;

      // Render only if candidate has at least one expected numeric-ish field.
      const hasKnownField =
        candidate.temperature_c !== undefined ||
        candidate.temperature !== undefined ||
        candidate.humidity_pct !== undefined ||
        candidate.humidity !== undefined ||
        candidate.gas_adc !== undefined ||
        candidate.aqi !== undefined;

      if (!hasKnownField) return;

      setStatus("ok", "Live (/sensor fallback)");
      render(candidate);
    },
    () => {}
  );
}

start().catch((error) => {
  setStatus("err", "Startup failed");
  console.error(error);
});
