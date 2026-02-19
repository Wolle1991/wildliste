// ✅ bereits für dich eingetragen:
const API_URL = "https://script.google.com/macros/s/AKfycby6w1PI-UOoL9_Mk8vCz4ySFVQ29eDFE-cCt6jmKLbAtDXhyH5pFa5OYnpISe_JeSlB/exec";
const GOOGLE_CLIENT_ID = "157730272233-v5a1cq7839rrp3rr26qmo8fn4s4o4099.apps.googleusercontent.com";

let authToken = null;
let selectedSellId = null;

const $ = (id) => document.getElementById(id);

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function num(n) {
  const x = Number(n || 0);
  return x.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ---------------- JSONP (CORS-frei) ---------------- **/

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    script.src = url + sep + "callback=" + cbName;

    window[cbName] = (data) => {
      try { delete window[cbName]; } catch {}
      script.remove();
      resolve(data);
    };

    script.onerror = () => {
      try { delete window[cbName]; } catch {}
      script.remove();
      reject(new Error("Failed to fetch (JSONP)"));
    };

    document.body.appendChild(script);
  });
}

async function apiList() {
  const url = new URL(API_URL);
  url.searchParams.set("action", "list");
  url.searchParams.set("idtoken", authToken); // ✅ idtoken statt auth
  const data = await jsonp(url.toString());
  if (!data.ok) throw new Error(data.error || "API Fehler");
  return data.rows;
}

async function apiAdd({ tier, teil, gewicht, preis }) {
  const url = new URL(API_URL);
  url.searchParams.set("action", "add");
  url.searchParams.set("idtoken", authToken);
  url.searchParams.set("tier", tier);
  url.searchParams.set("teil", teil);
  url.searchParams.set("gewicht", String(gewicht));
  url.searchParams.set("preis", String(preis));
  const data = await jsonp(url.toString());
  if (!data.ok) throw new Error(data.error || "API Fehler");
  return data;
}

async function apiSell({ id, kunde, bezahlt }) {
  const url = new URL(API_URL);
  url.searchParams.set("action", "sell");
  url.searchParams.set("idtoken", authToken);
  url.searchParams.set("id", id);
  url.searchParams.set("kunde", kunde || "");
  url.searchParams.set("bezahlt", bezahlt ? "JA" : "NEIN");
  const data = await jsonp(url.toString());
  if (!data.ok) throw new Error(data.error || "API Fehler");
  return data;
}

/** ---------------- UI / Rendering ---------------- **/

function setLoggedIn(label) {
  $("userInfo").textContent = `Eingeloggt: ${label}`;
  $("logoutBtn").style.display = "";
  $("refreshBtn").disabled = false;
  $("addBtn").disabled = false;
  $("sellBtn").disabled = false;
}

function setLoggedOut() {
  authToken = null;
  $("userInfo").textContent = "Nicht eingeloggt";
  $("logoutBtn").style.display = "none";
  $("refreshBtn").disabled = true;
  $("addBtn").disabled = true;
  $("sellBtn").disabled = true;
}

function renderTables(rows) {
  const stock = rows.filter(r => r.status === "IN_STOCK" && Number(r.gewicht) > 0);
  const sold  = rows.filter(r => r.status === "SOLD");

  // Bestand
  const tb1 = $("stockTable").querySelector("tbody");
  tb1.innerHTML = "";
  stock.forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "rowbtn";
    tr.title = "Zum Verkaufen auswählen";
    tr.innerHTML = `
      <td>${r.tier || ""}</td>
      <td>${r.teil || ""}</td>
      <td>${num(r.gewicht)}</td>
      <td>${money(r.preis)}</td>
      <td>${money(r.gesamt)}</td>
    `;
    tr.addEventListener("click", () => {
      selectedSellId = r.id;
      $("sellId").textContent = r.id;
      $("sellLabel").textContent = `${r.tier} – ${r.teil} – ${num(r.gewicht)} kg – ${money(r.gesamt)}`;
      $("sellMsg").textContent = "";
    });
    tb1.appendChild(tr);
  });

  // Historie
  const tb2 = $("soldTable").querySelector("tbody");
  tb2.innerHTML = "";
  sold
    .sort((a,b) => new Date(b.datum || 0) - new Date(a.datum || 0))
    .forEach(r => {
      const dt = r.datum ? new Date(r.datum).toLocaleString("de-DE") : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.tier || ""}</td>
        <td>${r.teil || ""}</td>
        <td>${num(r.gewicht)}</td>
        <td>${money(r.gesamt)}</td>
        <td>${r.verkaeufer_name || r.verkaeufer_email || ""}</td>
        <td>${r.kunde || ""}</td>
        <td>${r.bezahlt || ""}</td>
        <td>${dt}</td>
      `;
      tb2.appendChild(tr);
    });
}

async function refresh() {
  $("addMsg").textContent = "";
  $("sellMsg").textContent = "";
  const rows = await apiList();
  renderTables(rows);
}

/** ---------------- Google Login (robust) ---------------- **/

function waitForGoogle(maxMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.google && google.accounts && google.accounts.id) return resolve();
      if (Date.now() - start > maxMs) return reject(new Error("Google Login Script lädt nicht (blockiert?)"));
      setTimeout(tick, 100);
    };
    tick();
  });
}

async function initGoogleLogin() {
  try {
    // Falls das Script langsam ist: warten bis es da ist
    await waitForGoogle();

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          authToken = (response && response.credential) ? String(response.credential) : "";
          if (!authToken) throw new Error("Kein Token von Google erhalten.");

          await refresh();                 // Server prüft Whitelist (users-Sheet)
          setLoggedIn("Google");
        } catch (e) {
          setLoggedOut();
          alert("Login ok, aber keine Berechtigung oder Fehler: " + e.message);
        }
      },
    });

    // Button rendern
    $("gbtn").innerHTML = ""; // falls Reload / doppelt
    google.accounts.id.renderButton($("gbtn"), { theme: "outline", size: "large", text: "signin_with" });

  } catch (e) {
    // Wenn z.B. iOS Tracking/Adblock Google blockt
    $("userInfo").textContent = "Login nicht verfügbar";
    $("gbtn").innerHTML = `<div style="color:#b00;">Google Login konnte nicht geladen werden. Prüfe Adblock/Tracking-Schutz oder öffne die Seite in einem anderen Browser.</div>`;
  }
}

/** ---------------- Button Handlers ---------------- **/

$("refreshBtn").addEventListener("click", () => refresh());

$("logoutBtn").addEventListener("click", () => {
  setLoggedOut();
  $("stockTable").querySelector("tbody").innerHTML = "";
  $("soldTable").querySelector("tbody").innerHTML = "";
  $("sellId").textContent = "—";
  $("sellLabel").textContent = "—";
});

$("addBtn").addEventListener("click", async () => {
  try {
    const tier = $("tier").value;
    const teil = $("teil").value.trim();
    const gewicht = Number($("gewicht").value);
    const preis = Number($("preis").value);

    if (!teil) throw new Error("Bitte Teilstück eintragen.");
    if (!gewicht || gewicht <= 0) throw new Error("Bitte gültiges Gewicht eingeben.");
    if (!preis || preis <= 0) throw new Error("Bitte gültigen Preis eingeben.");

    await apiAdd({ tier, teil, gewicht, preis });

    $("addMsg").textContent = "✅ Eingelagert.";
    $("teil").value = "";
    $("gewicht").value = "";
    $("preis").value = "";

    await refresh();
  } catch (e) {
    $("addMsg").textContent = "❌ " + e.message;
  }
});

$("sellBtn").addEventListener("click", async () => {
  try {
    if (!selectedSellId) {
      $("sellMsg").textContent = "Bitte erst im Bestand einen Artikel anklicken.";
      return;
    }
    const kunde = $("kunde").value.trim();
    const bezahlt = $("bezahlt").checked;

    await apiSell({ id: selectedSellId, kunde, bezahlt });

    $("sellMsg").textContent = "✅ Als verkauft gespeichert.";
    $("kunde").value = "";
    $("bezahlt").checked = false;

    selectedSellId = null;
    $("sellId").textContent = "—";
    $("sellLabel").textContent = "—";

    await refresh();
  } catch (e) {
    $("sellMsg").textContent = "❌ " + e.message;
  }
});

/** ---------------- Start ---------------- **/
setLoggedOut();
initGoogleLogin();
