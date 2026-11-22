// This is a light "keep casual visitors out" gate, not real security - the
// data on this site is low-sensitivity (first names and Hebrew birth dates).
const PASSWORD_HASH_HEX =
  "19ffec6f803a30200b135e2f8dfe1d6ac90703f27a23aa528aa55bb091fbafcf";
const STORAGE_KEY = "family-birthdays-unlocked";

// EmailJS config - these are the public client-side IDs (not secrets), from
// the EmailJS dashboard. Restrict allowed origins in the EmailJS dashboard to
// this site's domain to prevent abuse.
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";

let peopleData = [];
let currentView = "date";

emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

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

function cardIcon(daysUntil) {
  if (daysUntil <= 7) return "🎉";
  if (daysUntil <= 14) return "🎈";
  return "🎂";
}

function buildCard(person) {
  const card = document.createElement("div");
  card.className = "card" + (person.daysUntil <= 14 ? " soon" : "");
  card.innerHTML = `
    <div class="name">${cardIcon(person.daysUntil)} ${person.name}</div>
    <div class="hebrew-date">${person.hebrewLabel}</div>
    <div class="days">${dayLabel(person.daysUntil)}</div>
    <div class="greg-date">${formatGregorian(person.nextGregorianDate)}</div>
  `;
  card.addEventListener("click", () => openGreetingModal(person));
  return card;
}

function renderByDate(cardsEl) {
  for (const person of peopleData) {
    cardsEl.appendChild(buildCard(person));
  }
}

function renderByFamily(cardsEl) {
  const groups = new Map();
  for (const person of peopleData) {
    if (!groups.has(person.family)) groups.set(person.family, []);
    groups.get(person.family).push(person);
  }

  for (const [family, members] of groups) {
    const section = document.createElement("div");
    section.className = "family-group";
    const heading = document.createElement("h2");
    heading.textContent = family;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "cards";
    for (const person of members) {
      grid.appendChild(buildCard(person));
    }
    section.appendChild(grid);
    cardsEl.appendChild(section);
  }
}

function renderCards() {
  const cardsEl = document.getElementById("cards");
  cardsEl.innerHTML = "";
  cardsEl.className = currentView === "date" ? "cards" : "";
  if (currentView === "date") {
    renderByDate(cardsEl);
  } else {
    renderByFamily(cardsEl);
  }
}

async function renderApp() {
  const res = await fetch("data.json", { cache: "no-store" });
  const { generatedAt, people } = await res.json();
  peopleData = people;
  renderCards();

  document.getElementById("updated-at").textContent =
    "עודכן לאחרונה: " + new Date(generatedAt).toLocaleDateString("he-IL");
}

function setView(view) {
  currentView = view;
  document.getElementById("view-date").classList.toggle("active", view === "date");
  document.getElementById("view-family").classList.toggle("active", view === "family");
  renderCards();
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

let activePerson = null;

function openGreetingModal(person) {
  activePerson = person;
  document.getElementById("modal-title").textContent = `🎁 ברכה ל${person.name}`;
  document.getElementById("greeting-text").value = "";
  document.getElementById("greeting-status").textContent = "";
  document.getElementById("greeting-send").disabled = false;
  document.getElementById("greeting-modal").classList.remove("hidden");
}

function closeGreetingModal() {
  document.getElementById("greeting-modal").classList.add("hidden");
  activePerson = null;
}

async function sendGreeting() {
  const text = document.getElementById("greeting-text").value.trim();
  const statusEl = document.getElementById("greeting-status");
  if (!text) {
    statusEl.textContent = "כתבו משהו לפני השליחה";
    return;
  }
  if (!activePerson) return;

  const sendBtn = document.getElementById("greeting-send");
  sendBtn.disabled = true;
  statusEl.textContent = "שולח...";

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: activePerson.familyEmail,
      person_name: activePerson.name,
      message: text,
    });
    statusEl.textContent = "הברכה נשלחה בהצלחה!";
    setTimeout(closeGreetingModal, 1500);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "שליחה נכשלה, נסו שוב";
    sendBtn.disabled = false;
  }
}

document.getElementById("unlock-button").addEventListener("click", tryUnlock);
document.getElementById("password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});
document.getElementById("view-date").addEventListener("click", () => setView("date"));
document.getElementById("view-family").addEventListener("click", () => setView("family"));
document.getElementById("modal-close").addEventListener("click", closeGreetingModal);
document.getElementById("greeting-send").addEventListener("click", sendGreeting);
document.getElementById("greeting-modal").addEventListener("click", (e) => {
  if (e.target.id === "greeting-modal") closeGreetingModal();
});

if (localStorage.getItem(STORAGE_KEY) === "1") {
  showApp();
}
