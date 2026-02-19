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

async function apiGetAll() {
  const url = new URL(API_URL);
  url.searchParams.set("auth", authToken);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API Fehler");
  return data.rows;
}

async function apiPost(payload) {
  payload.auth = authToken;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API Fehler");
  return data;
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
  const rows = await apiGetAll();
  renderTables(rows);
}

function initGoogleLogin() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (response) => {
      try {
        authToken = response.credential; // Google ID Token
        await refresh();                // Server prüft Whitelist (users-Sheet)
        setLoggedIn("Google");
      } catch (e) {
        setLoggedOut();
        alert("Login ok, aber keine Berechtigung oder Fehler: " + e.message);
      }
    },
  });

  google.accounts.id.renderButton($("gbtn"), { theme: "outline", size: "large", text: "signin_with" });
}

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

    await apiPost({ action: "add", tier, teil, gewicht, preis });
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

    await apiPost({ action: "sell", id: selectedSellId, kunde, bezahlt });

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

setLoggedOut();
initGoogleLogin();
