/* =========================
   CONFIG
   ========================= */

const API = "https://www.1secmail.com/api/v1/";
const DOMAINS = ["1secmail.com", "1secmail.org", "1secmail.net"];

const state = {
  login: null,
  domain: null,
  email: null,
  messages: [],
  saved: [],
  timerInterval: null,
  pollInterval: null,
  expiresIn: 10 * 60,
};

const $ = (id) => document.getElementById(id);

const emailAddressEl = $("emailAddress");
const copyBtn = $("copyBtn");
const saveBtn = $("saveBtn");
const saveText = $("saveText");
const newEmailBtn = $("newEmailBtn");
const refreshBtn = $("refreshBtn");
const timerEl = $("timer");
const messageNumberEl = $("messageNumber");
const mailCountEl = $("mailCount");
const mailListEl = $("mailList");
const savedListEl = $("savedList");
const savedCountEl = $("savedCount");

const modal = $("modal");
const closeModal = $("closeModal");
const modalSubject = $("modalSubject");
const modalFrom = $("modalFrom");
const modalContent = $("modalContent");

const toast = $("toast");

/* =========================
   NAMA RANDOM
   ========================= */

const FIRST_NAMES = [
  "budi","andi","rizky","dimas","fajar","gilang","hafiz","ivan","joko","kevin",
  "lukman","made","nanda","oscar","putra","qori","raka","satria","taufik","umar",
  "vino","wahyu","yoga","zaki","agus","bagas","candra","dewa","eka","farhan",
  "siti","dewi","ayu","bella","citra","dinda","elisa","fitri","gita","hana",
  "indah","jihan","kirana","lina","maya","nadia","okta","putri","ratna","sari",
  "tika","umi","vina","wulan","yuni","zahra","alya","bunga","clara","dita",
  "emma","fira","gina","hilda","irma","jessica","kayla","lia","mira","nisa",
  "olivia","prisca","queen","rina","salsa","tania","ulfa","vela","wina","yola",
  "alex","brian","chris","david","ethan","felix","george","harry","ian","jack",
  "liam","mike","nathan","peter","quinn","ryan","sam","tom"
];

const LAST_NAMES = [
  "santoso","wijaya","kusuma","pratama","setiawan","hidayat","nugroho","firmansyah",
  "ramadhan","maulana","putra","permana","saputra","gunawan","halim","junaedi",
  "kurniawan","lestari","mulyadi","nurhaliza","oktaviani","purnama","rahayu",
  "safitri","tirtana","utami","valentina","wardani","yuliana","zulkarnain",
  "smith","johnson","williams","brown","jones","garcia","miller","davis",
  "rodriguez","martinez","hernandez","lopez","gonzalez","wilson","anderson",
  "thomas","taylor","moore","jackson","martin","lee","perez","thompson",
  "white","harris","sanchez","clark","ramirez","lewis","robinson"
];

function randomName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const num = Math.floor(Math.random() * 9000) + 100;
  return `${first}${last}${num}`.toLowerCase();
}

/* =========================
   HELPERS
   ========================= */

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* =========================
   API — 1secmail
   ========================= */

async function jsonFetch(url, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(500 + i * 500);
    }
  }
  throw lastErr || new Error("fetch gagal");
}

async function fetchMessages() {
  if (!state.login) return [];
  const url = `${API}?action=getMessages&login=${encodeURIComponent(
    state.login
  )}&domain=${encodeURIComponent(state.domain)}`;
  const data = await jsonFetch(url);
  return Array.isArray(data) ? data : [];
}

async function fetchMessage(id) {
  const url = `${API}?action=readMessage&login=${encodeURIComponent(
    state.login
  )}&domain=${encodeURIComponent(state.domain)}&id=${id}`;
  return jsonFetch(url);
}

/* =========================
   RENDER INBOX
   ========================= */

function renderMessages() {
  const count = state.messages.length;
  messageNumberEl.textContent = count;
  mailCountEl.textContent = `${count} message${count !== 1 ? "s" : ""}`;

  if (!count) {
    mailListEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24">
            <path d="M4 5h16v14H4z"/>
            <path d="m4 7 8 6 8-6"/>
          </svg>
        </div>
        <h4>inbox is empty</h4>
        <p>incoming emails will appear here</p>
      </div>`;
    return;
  }

  mailListEl.innerHTML = state.messages
    .map(
      (m) => `
      <div class="mail" data-id="${m.id}">
        <div class="mail-icon">✉</div>
        <div class="mail-info">
          <strong>${escapeHtml(m.from || "unknown")}</strong>
          <span>${escapeHtml(m.subject || "(no subject)")}</span>
        </div>
        <div class="mail-time">${timeAgo(m.date)}</div>
      </div>`
    )
    .join("");

  mailListEl.querySelectorAll(".mail").forEach((el) => {
    el.addEventListener("click", () => openMessage(el.dataset.id));
  });
}

/* =========================
   RENDER SAVED
   ========================= */

function renderSaved() {
  savedCountEl.textContent = `${state.saved.length} saved`;

  if (!state.saved.length) {
    savedListEl.innerHTML = `
      <div class="saved-empty">
        <div>
          <svg viewBox="0 0 24 24">
            <path d="M5 4h14v17l-7-4-7 4z"/>
          </svg>
        </div>
        <p>save an email to access it later</p>
      </div>`;
    return;
  }

  savedListEl.innerHTML = state.saved
    .map((s) => {
      const isActive = s.email === state.email;
      return `
      <div class="saved-item ${isActive ? "active" : ""}" data-email="${escapeHtml(s.email)}">
        <div class="saved-main">
          <strong>${escapeHtml(s.email)}</strong>
          <span>${isActive ? "● sedang dipakai" : "saved " + timeAgo(s.savedAt)}</span>
        </div>
        <div class="saved-actions">
          <button class="use" title="Pakai email ini">↻</button>
          <button class="delete" title="Hapus">✕</button>
        </div>
      </div>`;
    })
    .join("");

  savedListEl.querySelectorAll(".saved-item").forEach((el) => {
    const email = el.dataset.email;
    el.querySelector(".saved-main").addEventListener("click", () => {
      copyToClipboard(email);
      showToast("email disalin");
    });
    el.querySelector(".use").addEventListener("click", (e) => {
      e.stopPropagation();
      useSavedEmail(email);
    });
    el.querySelector(".delete").addEventListener("click", (e) => {
      e.stopPropagation();
      removeSaved(email);
    });
  });
}

function updateSaveButton() {
  const isSaved = state.saved.some((s) => s.email === state.email);
  saveBtn.classList.toggle("saved", isSaved);
  saveText.textContent = isSaved ? "Saved" : "Save";
}

/* =========================
   MODAL
   ========================= */

async function openMessage(id) {
  try {
    const msg = await fetchMessage(id);
    modalSubject.textContent = msg.subject || "(no subject)";
    modalFrom.textContent = msg.from || "unknown";

    let body = "";
    if (msg.textBody) {
      body = escapeHtml(msg.textBody).replace(/\n/g, "<br>");
    } else if (msg.htmlBody) {
      body = msg.htmlBody;
    } else {
      body = "(empty message)";
    }

    modalContent.innerHTML = body;
    modal.classList.add("active");
  } catch (err) {
    showToast("gagal buka pesan");
  }
}

function closeModalFn() {
  modal.classList.remove("active");
}

closeModal.addEventListener("click", closeModalFn);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModalFn();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModalFn();
});

/* =========================
   SAVED EMAILS
   ========================= */

function loadSaved() {
  try {
    state.saved = JSON.parse(localStorage.getItem("tempmail_saved") || "[]");
  } catch {
    state.saved = [];
  }
  renderSaved();
  updateSaveButton();
}

function persistSaved() {
  localStorage.setItem("tempmail_saved", JSON.stringify(state.saved));
  renderSaved();
  updateSaveButton();
}

function toggleSave() {
  if (!state.email) return;
  const idx = state.saved.findIndex((s) => s.email === state.email);
  if (idx >= 0) {
    state.saved.splice(idx, 1);
    showToast("dihapus dari saved");
  } else {
    state.saved.unshift({
      email: state.email,
      savedAt: new Date().toISOString(),
    });
    showToast("email disimpan");
  }
  persistSaved();
}

function removeSaved(email) {
  state.saved = state.saved.filter((s) => s.email !== email);
  persistSaved();
  showToast("dihapus");
}

/* =========================
   PAKAI EMAIL DARI SAVED
   ========================= */

function parseEmail(email) {
  const [login, domain] = email.split("@");
  return { login, domain };
}

async function useSavedEmail(email) {
  if (email === state.email) {
    showToast("email ini sedang dipakai");
    return;
  }

  const { login, domain } = parseEmail(email);
  if (!login || !domain) {
    showToast("email tidak valid");
    return;
  }

  stopTimer();
  clearInterval(state.pollInterval);

  state.login = login;
  state.domain = domain;
  state.email = email;
  state.messages = [];

  emailAddressEl.textContent = email;
  updateSaveButton();
  renderMessages();

  startTimer();
  startPolling();

  await refreshMessages(true);
  showToast("email dipakai");
}

/* =========================
   TIMER
   ========================= */

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function startTimer() {
  stopTimer();
  state.expiresIn = 10 * 60;
  timerEl.textContent = formatTime(state.expiresIn);

  state.timerInterval = setInterval(() => {
    state.expiresIn--;
    if (state.expiresIn <= 0) {
      stopTimer();
      timerEl.textContent = "00:00";
      showToast("email expired, membuat baru...");
      createNewEmail();
      return;
    }
    timerEl.textContent = formatTime(state.expiresIn);
  }, 1000);
}

/* =========================
   COPY
   ========================= */

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("copied");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("copied");
  }
}

/* =========================
   REFRESH / POLL
   ========================= */

async function refreshMessages(silent = false) {
  if (!state.login) return;
  try {
    const list = await fetchMessages();
    const changed = list.length !== state.messages.length;
    state.messages = list;
    if (changed || !silent) renderMessages();
  } catch (err) {
    if (!silent) showToast("gagal refresh");
  }
}

function startPolling() {
  clearInterval(state.pollInterval);
  state.pollInterval = setInterval(() => refreshMessages(true), 8000);
}

/* =========================
   INIT
   ========================= */

async function createNewEmail() {
  stopTimer();
  clearInterval(state.pollInterval);
  state.messages = [];

  emailAddressEl.textContent = "loading...";
  mailListEl.innerHTML = "";
  messageNumberEl.textContent = "0";
  mailCountEl.textContent = "0 messages";
  renderMessages();

  const login = randomName();
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const email = `${login}@${domain}`;

  state.login = login;
  state.domain = domain;
  state.email = email;

  emailAddressEl.textContent = email;
  updateSaveButton();

  startTimer();
  startPolling();

  try {
    await refreshMessages(true);
  } catch (_) {}
}

function init() {
  loadSaved();

  copyBtn.addEventListener("click", () => {
    if (state.email) copyToClipboard(state.email);
  });

  saveBtn.addEventListener("click", toggleSave);
  newEmailBtn.addEventListener("click", createNewEmail);
  refreshBtn.addEventListener("click", () => refreshMessages(false));

  createNewEmail();
}

document.addEventListener("DOMContentLoaded", init);
