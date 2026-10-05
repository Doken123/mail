/* =========================
   CONFIG
   ========================= */

const API = "https://api.mail.tm";

const state = {
  token: null,
  accountId: null,
  email: null,
  messages: [],
  saved: [],
  timerInterval: null,
  pollInterval: null,
  expiresIn: 10 * 60, // detik
};

const $ = (id) => document.getElementById(id);

/* =========================
   DOM
   ========================= */

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
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
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

/* =========================
   API
   ========================= */

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(API + path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function getDomains() {
  const data = await api("/domains?page=1");
  const list = data["hydra:member"] || data;
  if (!list.length) throw new Error("No domain available");
  return list[0].domain;
}

async function createAccount() {
  const domain = await getDomains();
  const address = `${randomString(10)}@${domain}`;
  const password = randomString(16);

  await api("/accounts", {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });

  const login = await api("/token", {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });

  state.token = login.token;
  state.email = address;

  const me = await api("/me");
  state.accountId = me.id;

  return address;
}

async function fetchMessages() {
  const data = await api("/messages?page=1");
  return data["hydra:member"] || data;
}

async function fetchMessage(id) {
  return api(`/messages/${id}`);
}

async function deleteMessage(id) {
  return api(`/messages/${id}`, { method: "DELETE" });
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
          <strong>${escapeHtml(m.from?.address || "unknown")}</strong>
          <span>${escapeHtml(m.subject || "(no subject)")}</span>
        </div>
        <div class="mail-time">${timeAgo(m.createdAt)}</div>
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
      switchToSaved(email);
    });
    el.querySelector(".delete").addEventListener("click", (e) => {
      e.stopPropagation();
      removeSaved(email);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    modalFrom.textContent = msg.from?.address || "unknown";

    let body = "";
    if (msg.text) {
      body = escapeHtml(msg.text).replace(/\n/g, "<br>");
    } else if (msg.html && msg.html.length) {
      body = Array.isArray(msg.html) ? msg.html.join("") : msg.html;
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
    state.saved.unshift({ email: state.email, savedAt: new Date().toISOString() });
    showToast("email disimpan");
  }
  persistSaved();
}

function removeSaved(email) {
  state.saved = state.saved.filter((s) => s.email !== email);
  persistSaved();
  showToast("dihapus");
}

async function switchToSaved(email) {
  // Karena mail.tm butuh password, kita hanya bisa mengingatkan
  showToast("gunakan email ini di sesi baru");
  copyToClipboard(email);
}

/* =========================
   TIMER
   ========================= */

function startTimer() {
  clearInterval(state.timerInterval);
  state.expiresIn = 10 * 60;
  timerEl.textContent = formatTime(state.expiresIn);

  state.timerInterval = setInterval(() => {
    state.expiresIn--;
    if (state.expiresIn <= 0) {
      clearInterval(state.timerInterval);
      timerEl.textContent = "00:00";
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
  if (!state.token) return;
  try {
    const list = await fetchMessages();
    state.messages = list;
    renderMessages();
    if (!silent && list.length === 0) {
      // tetap diam
    }
  } catch (err) {
    if (!silent) showToast("gagal refresh");
  }
}

function startPolling() {
  clearInterval(state.pollInterval);
  state.pollInterval = setInterval(() => {
    refreshMessages(true);
  }, 10000);
}

/* =========================
   INIT
   ========================= */

async function createNewEmail() {
  emailAddressEl.textContent = "loading...";
  mailListEl.innerHTML = "";
  state.messages = [];

  try {
    const address = await createAccount();
    emailAddressEl.textContent = address;
    updateSaveButton();
    startTimer();
    startPolling();
    await refreshMessages(true);
  } catch (err) {
    emailAddressEl.textContent = "error";
    showToast("gagal buat email");
    console.error(err);
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
