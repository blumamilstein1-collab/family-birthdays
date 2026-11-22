// This is a light "keep casual visitors out" gate, not real security - the
// data on this site is low-sensitivity (first names and Hebrew birth dates).
const PASSWORD_HASH_HEX =
  "c5909d0929a792e9d173dfb2955b0d566813037def3bf7f581b8ac18c3b9601d";
const STORAGE_KEY = "family-birthdays-unlocked";

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function dayLabel(daysUntil) {
  if (daysUntil === 0) return "היום!";
  if (daysUntil === 1) return "מחר";
  return `בעוד ${daysUntil} ימים`;
}

function formatGregorian(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

async function renderApp() {
  const res = await fetch("data.json", { cache: "no-store" });
  const { generatedAt, people } = await res.json();

  const cardsEl = document.getElementById("cards");
  cardsEl.innerHTML = "";

  for (const person of people) {
    const card = document.createElement("div");
    card.className = "card" + (person.daysUntil <= 14 ? " soon" : "");
    card.innerHTML = `
      <div class="name">${person.name}</div>
      <div class="hebrew-date">${person.hebrewLabel}</div>
      <div class="days">${dayLabel(person.daysUntil)}</div>
      <div class="greg-date">${formatGregorian(person.nextGregorianDate)}</div>
    `;
    cardsEl.appendChild(card);
  }

  document.getElementById("updated-at").textContent =
    "עודכן לאחרונה: " + new Date(generatedAt).toLocaleDateString("he-IL");
}

function showApp() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  renderApp();
}

async function tryUnlock() {
  const input = document.getElementById("password-input");
  const errorEl = document.getElementById("gate-error");
  const hash = await sha256Hex(input.value);
  if (hash === PASSWORD_HASH_HEX) {
    localStorage.setItem(STORAGE_KEY, "1");
    showApp();
  } else {
    errorEl.textContent = "סיסמה שגויה, נסו שוב";
  }
}

document.getElementById("unlock-button").addEventListener("click", tryUnlock);
document.getElementById("password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});

if (localStorage.getItem(STORAGE_KEY) === "1") {
  showApp();
}
