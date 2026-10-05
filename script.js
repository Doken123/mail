/* ===================
   TempMail — mail.gw
   =================== */

const API = "https://api.mail.gw";

const state = {
  token: null,
  address: null,
  password: null,
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

const FIRST = ["budi","andi","rizky","dimas","fajar","gilang","hafiz","ivan","joko",
  "kevin","lukman","nanda","oscar","putra","raka","satria","taufik","umar","wahyu",
  "yoga","siti","dewi","ayu","bella","citra","dinda","elisa","fitri","gita","hana",
  "indah","jihan","kirana","lina","maya","nadia","putri","ratna","sari","tika",
  "alya","bunga","clara","dita","emma","fira","gina","hilda","irma","jessica",
  "alex","brian","chris","david","ethan","felix","harry","ian","jack","liam"];

const LAST = ["santoso","wijaya","kusuma","pratama","setiawan","hidayat","nugroho",
  "firmansyah","ramadhan","maulana","permana","saputra","gunawan","halim","junaedi",
  "kurniawan","lestari","mulyadi","purnama","rahayu","safitri","utami","wardani",
  "yuliana","smith","johnson","williams","brown","jones","garcia","miller","davis",
  "wilson","anderson","thomas","taylor","moore","jackson","martin","lee",
  "white","harris","clark","lewis","robinson","walker","hall","young"];

function randomName() {
  const f = FIRST[Math.floor(Math.random() * FIRST.length)];
  const l = LAST[Math.floor(Math.random() * LAST.length)];
  const n = Math.floor(Math.random() * 9000) + 100;
  return (f + l + n).toLowerCase();
}

function randomPass() {
  let s = "";
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 16; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

/* ===================
   HELPERS
   =================== */

function showToast(t) {
  toast.textContent = t;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () {
    toast.classList.remove("show");
  }, 1800);
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

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function api(path, method, body, needToken) {
  const headers = { "Content-Type": "application/json" };
  if (needToken !== false && state.token) {
    headers.Authorization = "Bearer " + state.token;
  }
  const opts = {
    method: method || "GET",
    headers: headers,
    cache: "no-store",
  };
  if (body) opts.body = JSON.stringify(body);

  return fetch(API + path, opts).then(function (res) {
    if (res.status === 204) return null;
    return res.text().then(function (txt) {
      let data = null;
      try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
      if (!res.ok) {
        const msg = (data && (data.message || data["hydra:description"])) ||
          ("HTTP " + res.status);
        throw new Error(msg);
      }
      return data;
    });
  });
}

/* ===================
   MAIL.GW API
   =================== */

function getDomain() {
  return api("/domains?page=1", "GET", null, false).then(function (d) {
    const list = d["hydra:member"] || d;
    if (!list || !list.length) throw new Error("no domain");
    const active = list.filter(function (x) { return x.isActive !== false; });
    const pick = active.length
      ? active[Math.floor(Math.random() * active.length)]
      : list[0];
    return pick.domain;
  });
}

function createAccount(retries) {
  retries = retries == null ? 3 : retries;
  let addr, pass;

  return getDomain().then(function (domain) {
    addr = randomName() + "@" + domain;
    pass = randomPass();
    return api("/accounts", "POST", { address: addr, password: pass }, false);
  }).then(function () {
    return api("/token", "POST", { address: addr, password: pass }, false);
  }).then(function (login) {
    state.token = login.token;
    state.address = addr;
    state.password = pass;
    return addr;
  }).catch(function (err) {
    if (retries > 0) {
      return sleep(800).then(function () { return createAccount(retries - 1); });
    }
    throw err;
  });
}

function fetchMessages() {
  if (!state.token) return Promise.resolve([]);
  return api("/messages?page=1").then(function (d) {
    const list = d["hydra:member"] || d || [];
    return list.map(function (m) {
      return {
        id: m.id,
        from: (m.from && m.from.address) || "unknown",
        subject: m.subject || "(no subject)",
        date: m.createdAt,
      };
    });
  });
}

function fetchMessage(id) {
  return api("/messages/" + id).then(function (msg) {
    let text = "";
    let isHtml = false;

    if (msg.html && (Array.isArray(msg.html) ? msg.html.length : msg.html)) {
      text = Array.isArray(msg.html) ? msg.html.join("") : msg.html;
      isHtml = true;
    } else if (msg.text) {
      text = msg.text;
      isHtml = false;
    } else {
      text = "(empty message)";
    }

    return {
      subject: msg.subject || "(no subject)",
      from: (msg.from && msg.from.address) || "unknown",
      text: text,
      isHtml: isHtml,
    };
  });
}

/* ===================
   INBOX RENDER
   =================== */

function renderMessages() {
  const count = state.messages.length;
  messageNumberEl.textContent = count;
  mailCountEl.textContent = count + " message" + (count !== 1 ? "s" : "");

  if (!count) {
    mailListEl.innerHTML =
      '<div class="empty">' +
      '<div class="empty-icon">' +
      '<svg viewBox="0 0 24 24">' +
      '<path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/>' +
      '</svg></div>' +
      '<h4>inbox is empty</h4>' +
      '<p>incoming emails will appear here</p>' +
      '</div>';
    return;
  }

  let html = "";
  state.messages.forEach(function (m) {
    html +=
      '<div class="mail" data-id="' + esc(m.id) + '">' +
      '<div class="mail-icon">✉</div>' +
      '<div class="mail-info">' +
      "<strong>" + esc(m.from) + "</strong>" +
      "<span>" + esc(m.subject) + "</span>" +
      "</div>" +
      '<div class="mail-time">' + timeAgo(m.date) + "</div>" +
      "</div>";
  });
  mailListEl.innerHTML = html;

  mailListEl.querySelectorAll(".mail").forEach(function (el) {
    el.addEventListener("click", function () { openMessage(el.dataset.id); });
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
      '<div><svg viewBox="0 0 24 24"><path d="M5 4h14v17l-7-4-7 4z"/></svg></div>' +
      '<p>save an email to access it later</p>' +
      '</div>';
    return;
  }

  let html = "";
  state.saved.forEach(function (s) {
    const active = s.email === state.address;
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
      "</div></div>";
  });
  savedListEl.innerHTML = html;

  savedListEl.querySelectorAll(".saved-item").forEach(function (el) {
    const email = el.dataset.email;
    el.querySelector(".saved-main").addEventListener("click", function () {
      copyToClipboard(email);
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
    if (state.saved[i].email === state.address) { isSaved = true; break; }
  }
  saveBtn.classList.toggle("saved", isSaved);
  saveText.textContent = isSaved ? "Saved" : "Save";
}

/* ===================
   MODAL
   =================== */

function linkifyText(text) {
  return esc(text)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    )
    .replace(/\n/g, "<br>");
}

function sanitizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

function openMessage(id) {
  fetchMessage(id).then(function (msg) {
    modalSubject.textContent = msg.subject || "(no subject)";
    modalFrom.textContent = msg.from || "unknown";

    let body;
    if (msg.isHtml) {
      body = '<div class="mail-html">' + sanitizeHtml(msg.text) + "</div>";
    } else {
      body = '<div class="mail-plain">' + linkifyText(msg.text) + "</div>";
    }

    modalContent.innerHTML = body;
    modal.classList.add("active");

    modalContent.querySelectorAll("a").forEach(function (a) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }).catch(function () {
    showToast("gagal buka pesan");
  });
}

function closeModalFn() { modal.classList.remove("active"); }

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
    state.saved = JSON.parse(localStorage.getItem("tempmail_saved_gw") || "[]");
  } catch (e) { state.saved = []; }
  renderSaved();
  updateSaveButton();
}

function persistSaved() {
  localStorage.setItem("tempmail_saved_gw", JSON.stringify(state.saved));
  renderSaved();
  updateSaveButton();
}

function toggleSave() {
  if (!state.address) return;
  let idx = -1;
  for (let i = 0; i < state.saved.length; i++) {
    if (state.saved[i].email === state.address) { idx = i; break; }
  }
  if (idx >= 0) {
    state.saved.splice(idx, 1);
    showToast("dihapus dari saved");
  } else {
    state.saved.unshift({
      email: state.address,
      password: state.password,
      savedAt: new Date().toISOString(),
    });
    showToast("email disimpan");
  }
  persistSaved();
}

function removeSaved(email) {
  state.saved = state.saved.filter(function (s) { return s.email !== email; });
  persistSaved();
  showToast("dihapus");
}

function useSavedEmail(email) {
  if (email === state.address) {
    showToast("email ini sedang dipakai");
    return;
  }
  let found = null;
  for (let i = 0; i < state.saved.length; i++) {
    if (state.saved[i].email === email) { found = state.saved[i]; break; }
  }
  if (!found || !found.password) {
    showToast("password tidak tersimpan");
    return;
  }

  clearInterval(state.pollId);

  api("/token", "POST", { address: found.email, password: found.password }, false)
    .then(function (login) {
      state.token = login.token;
      state.address = found.email;
      state.password = found.password;
      state.messages = [];

      try {
        localStorage.setItem("tempmail_current_gw", JSON.stringify({
          email: found.email,
          password: found.password,
        }));
      } catch (e) {}

      emailAddressEl.textContent = found.email;
      updateSaveButton();
      renderMessages();
      startPolling();
      return refreshMessages(true);
    })
    .then(function () { showToast("email dipakai"); })
    .catch(function () { showToast("gagal pakai email"); });
}

/* ===================
   COPY
   =================== */

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function () { showToast("copied"); },
      function () { fallbackCopy(text); }
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
  try { document.execCommand("copy"); showToast("copied"); }
  catch (e) { showToast("gagal copy"); }
  document.body.removeChild(ta);
}

/* ===================
   REFRESH / POLL
   =================== */

function refreshMessages(silent) {
  if (!state.token) return Promise.resolve();
  return fetchMessages().then(function (list) {
    const changed = list.length !== state.messages.length;
    state.messages = list;
    if (changed || !silent) renderMessages();
  }).catch(function () {
    if (!silent) showToast("gagal refresh");
  });
}

function startPolling() {
  clearInterval(state.pollId);
  state.pollId = setInterval(function () {
    refreshMessages(true);
  }, 6000);
}

/* ===================
   CREATE NEW EMAIL
   =================== */

function createNewEmail() {
  clearInterval(state.pollId);
  state.token = null;
  state.address = null;
  state.password = null;
  state.messages = [];

  emailAddressEl.textContent = "loading...";
  mailListEl.innerHTML = "";
  messageNumberEl.textContent = "0";
  mailCountEl.textContent = "0 messages";

  createAccount(3)
    .then(function (address) {
      emailAddressEl.textContent = address;

      try {
        localStorage.setItem("tempmail_current_gw", JSON.stringify({
          email: address,
          password: state.password,
        }));
      } catch (e) {}

      updateSaveButton();
      startPolling();
      return refreshMessages(true);
    })
    .catch(function (err) {
      console.error(err);
      emailAddressEl.textContent = "gagal, tekan New";
      showToast("gagal buat email, tekan New");
    });
}

/* ===================
   INIT
   =================== */

function init() {
  loadSaved();

  copyBtn.addEventListener("click", function () {
    if (state.address) copyToClipboard(state.address);
  });
  saveBtn.addEventListener("click", toggleSave);

  newEmailBtn.addEventListener("click", function () {
    try { localStorage.removeItem("tempmail_current_gw"); } catch (e) {}
    createNewEmail();
  });

  refreshBtn.addEventListener("click", function () { refreshMessages(false); });

  // pakai email tersimpan
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("tempmail_current_gw") || "null");
  } catch (e) {}

  if (saved && saved.email && saved.password) {
    api("/token", "POST", { address: saved.email, password: saved.password }, false)
      .then(function (login) {
        state.token = login.token;
        state.address = saved.email;
        state.password = saved.password;
        emailAddressEl.textContent = saved.email;
        updateSaveButton();
        startPolling();
        return refreshMessages(true);
      })
      .catch(function () {
        createNewEmail();
      });
  } else {
    createNewEmail();
  }
}

document.addEventListener("DOMContentLoaded", init);
