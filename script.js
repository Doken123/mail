/* ===================
   TempMail — script
   =================== */

const API = "https://www.1secmail.com/api/v1/";
const DOMAINS = ["1secmail.com", "1secmail.org", "1secmail.net"];

const state = {
  login: null,
  domain: null,
  email: null,
  messages: [],
  saved: [],
  pollId: null,
};

const $ = (id) => document.getElementById(id);

const emailAddressEl = $("emailAddress");
const copyBtn = $("copyBtn");
const saveBtn = $("saveBtn");
const saveText = $("saveText");
const newEmailBtn = $("newEmailBtn");
const refreshBtn = $("refreshBtn");
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

/* ===================
   NAMA RANDOM
   =================== */

const FIRST = [
  "budi","andi","rizky","dimas","fajar","gilang","hafiz","ivan","joko","kevin",
  "lukman","nanda","oscar","putra","raka","satria","taufik","umar","wahyu","yoga",
  "siti","dewi","ayu","bella","citra","dinda","elisa","fitri","gita","hana",
  "indah","jihan","kirana","lina","maya","nadia","putri","ratna","sari","tika",
  "alya","bunga","clara","dita","emma","fira","gina","hilda","irma","jessica",
  "alex","brian","chris","david","ethan","felix","harry","ian","jack","liam"
];

const LAST = [
  "santoso","wijaya","kusuma","pratama","setiawan","hidayat","nugroho","firmansyah",
  "ramadhan","maulana","permana","saputra","gunawan","halim","junaedi","kurniawan",
  "lestari","mulyadi","purnama","rahayu","safitri","utami","wardani","yuliana",
  "smith","johnson","williams","brown","jones","garcia","miller","davis",
  "wilson","anderson","thomas","taylor","moore","jackson","martin","lee",
  "white","harris","clark","lewis","robinson","walker","hall","young"
];

function randomName() {
  const f = FIRST[Math.floor(Math.random() * FIRST.length)];
  const l = LAST[Math.floor(Math.random() * LAST.length)];
  const n = Math.floor(Math.random() * 9000) + 100;
  return (f + l + n).toLowerCase();
}

/* ===================
   HELPERS
   =================== */

function showToast(t) {
  toast.textContent = t;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
}

function timeAgo(d) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ===================
   API
   =================== */

async function apiGet(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function fetchMessages() {
  if (!state.login) return Promise.resolve([]);
  const url =
    API +
    "?action=getMessages&login=" +
    encodeURIComponent(state.login) +
    "&domain=" +
    encodeURIComponent(state.domain);
  return apiGet(url).then((d) => (Array.isArray(d) ? d : []));
}

function fetchMessage(id) {
  const url =
    API +
    "?action=readMessage&login=" +
    encodeURIComponent(state.login) +
    "&domain=" +
    encodeURIComponent(state.domain) +
    "&id=" +
    id;
  return apiGet(url);
}

/* ===================
   INBOX RENDER
   =================== */

function renderMessages() {
  const count = state.messages.length;
  messageNumberEl.textContent = count;
  mailCountEl.textContent =
    count + " message" + (count !== 1 ? "s" : "");

  if (!count) {
    mailListEl.innerHTML =
      '<div class="empty">' +
      '<div class="empty-icon">' +
      '<svg viewBox="0 0 24 24">' +
      '<path d="M4 5h16v14H4z"/>' +
      '<path d="m4 7 8 6 8-6"/>' +
      "</svg>" +
      "</div>" +
      "<h4>inbox is empty</h4>" +
      "<p>incoming emails will appear here</p>" +
      "</div>";
    return;
  }

  let html = "";
  state.messages.forEach(function (m) {
    html +=
      '<div class="mail" data-id="' + m.id + '">' +
      '<div class="mail-icon">✉</div>' +
      '<div class="mail-info">' +
      "<strong>" + esc(m.from) + "</strong>" +
      "<span>" + esc(m.subject || "(no subject)") + "</span>" +
      "</div>" +
      '<div class="mail-time">' + timeAgo(m.date) + "</div>" +
      "</div>";
  });
  mailListEl.innerHTML = html;

  const items = mailListEl.querySelectorAll(".mail");
  items.forEach(function (el) {
    el.addEventListener("click", function () {
      openMessage(el.dataset.id);
    });
  });
}

/* ===================
   SAVED RENDER
   =================== */

function renderSaved() {
  savedCountEl.textContent = state.saved.length + " saved";

  if (!state.saved.length) {
    savedListEl.innerHTML =
      '<div class="saved-empty">' +
      "<div>" +
      '<svg viewBox="0 0 24 24">' +
      '<path d="M5 4h14v17l-7-4-7 4z"/>' +
      "</svg>" +
      "</div>" +
      "<p>save an email to access it later</p>" +
      "</div>";
    return;
  }

  let html = "";
  state.saved.forEach(function (s) {
    const active = s.email === state.email;
    html +=
      '<div class="saved-item ' + (active ? "active" : "") +
      '" data-email="' + esc(s.email) + '">' +
      '<div class="saved-main">' +
      "<strong>" + esc(s.email) + "</strong>" +
      "<span>" + (active ? "● sedang dipakai" : "saved " + timeAgo(s.savedAt)) + "</span>" +
      "</div>" +
      '<div class="saved-actions">' +
      '<button class="use" title="Pakai">↻</button>' +
      '<button class="delete" title="Hapus">✕</button>' +
      "</div>" +
      "</div>";
  });
  savedListEl.innerHTML = html;

  const items = savedListEl.querySelectorAll(".saved-item");
  items.forEach(function (el) {
    const email = el.dataset.email;
    el.querySelector(".saved-main").addEventListener("click", function () {
      copyToClipboard(email);
      showToast("email disalin");
    });
    el.querySelector(".use").addEventListener("click", function (e) {
      e.stopPropagation();
      useSavedEmail(email);
    });
    el.querySelector(".delete").addEventListener("click", function (e) {
      e.stopPropagation();
      removeSaved(email);
    });
  });
}

function updateSaveButton() {
  let isSaved = false;
  for (let i = 0; i < state.saved.length; i++) {
    if (state.saved[i].email === state.email) {
      isSaved = true;
      break;
    }
  }
  saveBtn.classList.toggle("saved", isSaved);
  saveText.textContent = isSaved ? "Saved" : "Save";
}

/* ===================
   MODAL
   =================== */

function openMessage(id) {
  fetchMessage(id)
    .then(function (msg) {
      modalSubject.textContent = msg.subject || "(no subject)";
      modalFrom.textContent = msg.from || "unknown";
      let body = "";
      if (msg.textBody) {
        body = esc(msg.textBody).replace(/\n/g, "<br>");
      } else if (msg.htmlBody) {
        body = msg.htmlBody;
      } else {
        body = "(empty message)";
      }
      modalContent.innerHTML = body;
      modal.classList.add("active");
    })
    .catch(function () {
      showToast("gagal buka pesan");
    });
}

function closeModalFn() {
  modal.classList.remove("active");
}

closeModal.addEventListener("click", closeModalFn);
modal.addEventListener("click", function (e) {
  if (e.target === modal) closeModalFn();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeModalFn();
});

/* ===================
   SAVED
   =================== */

function loadSaved() {
  try {
    state.saved = JSON.parse(localStorage.getItem("tempmail_saved") || "[]");
  } catch (e) {
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
  let idx = -1;
  for (let i = 0; i < state.saved.length; i++) {
    if (state.saved[i].email === state.email) {
      idx = i;
      break;
    }
  }
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
  state.saved = state.saved.filter(function (s) {
    return s.email !== email;
  });
  persistSaved();
  showToast("dihapus");
}

/* ===================
   USE SAVED EMAIL
   =================== */

function useSavedEmail(email) {
  if (email === state.email) {
    showToast("email ini sedang dipakai");
    return;
  }
  const parts = email.split("@");
  const login = parts[0];
  const domain = parts[1];
  if (!login || !domain) {
    showToast("email tidak valid");
    return;
  }

  clearInterval(state.pollId);

  state.login = login;
  state.domain = domain;
  state.email = email;
  state.messages = [];

  emailAddressEl.textContent = email;
  updateSaveButton();
  renderMessages();

  startPolling();

  refreshMessages(true).then(function () {
    showToast("email dipakai");
  });
}

/* ===================
   COPY
   =================== */

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function () {
        showToast("copied");
      },
      function () {
        fallbackCopy(text);
      }
    );
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast("copied");
  } catch (e) {
    showToast("gagal copy");
  }
  document.body.removeChild(ta);
}

/* ===================
   REFRESH / POLL
   =================== */

function refreshMessages(silent) {
  if (!state.login) return Promise.resolve();
  return fetchMessages()
    .then(function (list) {
      const changed = list.length !== state.messages.length;
      state.messages = list;
      if (changed || !silent) renderMessages();
    })
    .catch(function () {
      if (!silent) showToast("gagal refresh");
    });
}

function startPolling() {
  clearInterval(state.pollId);
  state.pollId = setInterval(function () {
    refreshMessages(true);
  }, 8000);
}

/* ===================
   CREATE NEW EMAIL
   =================== */

function createNewEmail() {
  clearInterval(state.pollId);
  state.messages = [];

  emailAddressEl.textContent = "loading...";
  mailListEl.innerHTML = "";
  messageNumberEl.textContent = "0";
  mailCountEl.textContent = "0 messages";

  const login = randomName();
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const email = login + "@" + domain;

  state.login = login;
  state.domain = domain;
  state.email = email;

  // LANGSUNG tampilkan emailnya — tanpa nunggu API
  emailAddressEl.textContent = email;
  updateSaveButton();
  renderMessages();

  startPolling();
  refreshMessages(true);
}

/* ===================
   INIT
   =================== */

function init() {
  loadSaved();

  copyBtn.addEventListener("click", function () {
    if (state.email) copyToClipboard(state.email);
  });
  saveBtn.addEventListener("click", toggleSave);
  newEmailBtn.addEventListener("click", createNewEmail);
  refreshBtn.addEventListener("click", function () {
    refreshMessages(false);
  });

  createNewEmail();
}

document.addEventListener("DOMContentLoaded", init);
