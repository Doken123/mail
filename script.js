/* =========================
   CONFIG
   ========================= */

const API = "https://www.1secmail.com/api/v1/";

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
   HELPERS
   ========================= */

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
}

function randomString(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
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
   API — 1secmail (tanpa token)
   ========================= */

const DOMAINS = ["1secmail.com", "1secmail.org", "1secmail.net"];

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
   RENDER
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
    .map(
      (s) => `
      <div class="saved-item" data-email="${escapeHtml(s.email)}">
        <div class="saved-main">
          <strong>${escapeHtml(s.email)}</strong>
          <span>saved ${timeAgo(s.savedAt)}</span>
        </div>
        <div class="saved-actions">
          <button class="delete" title="Hapus">✕</button>
        </div>
      </div>`
    )
    .join("");

  savedListEl.querySelectorAll(".saved-item").forEach((el) => {
    const email = el.dataset.email;
    el.querySelector(".saved-main").addEventListener("click", () => {
      copyToClipboard(email);
      showToast("email disalin");
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
   SAVED
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
    // hanya render ulang kalau jumlahnya berubah biar tidak flicker
    if (list.length !== state.messages.length || !silent) {
      state.messages = list;
      renderMessages();
    } else {
      state.messages = list;
    }
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
  // reset
  stopTimer();
  clearInterval(state.pollInterval);
  state.login = null;
  state.domain = null;
  state.email = null;
  state.messages = [];

  emailAddressEl.textContent = "loading...";
  mailListEl.innerHTML = "";
  messageNumberEl.textContent = "0";
  mailCountEl.textContent = "0 messages";
  renderMessages();

  // bikin alamat baru (offline dulu biar tidak pernah gagal)
  const login = randomString(12).toLowerCase();
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const email = `${login}@${domain}`;

  state.login = login;
  state.domain = domain;
  state.email = email;

  emailAddressEl.textContent = email;
  updateSaveButton();

  // timer langsung jalan
  startTimer();
  startPolling();

  // cek koneksi inbox (kalau server error, tetap tampil emailnya)
  try {
    await refreshMessages(true);
  } catch (err) {
    // diamkan — email tetap tampil
  }
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
