/* ===================
   TempMail — Guerrilla Mail
   =================== */

const GAPI = "https://api.guerrillamail.com/ajax.php";

const state = {
  sid: null,
  address: null,
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

function qs(params) {
  const parts = [];
  for (const k in params) {
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
  }
  return parts.join("&");
}

function gapi(params) {
  const url = GAPI + "?" + qs(params);
  return fetch(url, { cache: "no-store" }).then(function (r) {
    return r.json().then(function (data) {
      if (!r.ok) throw new Error((data && data.error) || ("HTTP " + r.status));
      return data;
    });
  });
}

/* ===================
   GUERRILLA API
   =================== */

function createInbox() {
  return gapi({ f: "get_email_address", lang: "en" }).then(function (d) {
    if (!d || !d.email_addr) throw new Error("no address");
    state.sid = d.sid_token || null;
    state.address = d.email_addr;
    return d.email_addr;
  });
}

function fetchMessages() {
  const params = { f: "get_email_list", offset: 0 };
  if (state.sid) params.sid_token = state.sid;

  return gapi(params).then(function (d) {
    const list = (d && d.list) || [];
    return list.map(function (m) {
      return {
        id: m.mail_id,
        from: m.mail_from || "unknown",
        subject: m.mail_subject || "(no subject)",
        date: m.mail_timestamp
          ? new Date(m.mail_timestamp * 1000).toISOString()
          : new Date().toISOString(),
      };
    });
  });
}

function fetchMessage(id) {
  const params = { f: "fetch_email", email_id: id };
  if (state.sid) params.sid_token = state.sid;

  return gapi(params).then(function (msg) {
    let raw = msg.mail_body || "";

    // buang header: cari baris kosong pertama
    let body = raw;
    const i1 = raw.indexOf("\r\n\r\n");
    const i2 = raw.indexOf("\n\n");
    let cut = -1;
    if (i1 !== -1 && (i2 === -1 || i1 < i2)) cut = i1 + 4;
    else if (i2 !== -1) cut = i2 + 2;
    if (cut !== -1) body = raw.slice(cut);

    // kalau ternyata masih ada header, coba potong setelah baris "DKIM" / "MIME"
    if (/^(delivered-to|received|arc-seal|dkim-signature|mime-version)/i.test(body.trim())) {
      const lines = body.split(/\r?\n/);
      let start = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "") { start = i + 1; break; }
      }
      body = lines.slice(start).join("\n");
    }

    // kalau body pakai HTML asli, biarkan; kalau plain text, escape
    let isHtml = false;
    let text = body;

    if (msg.mail_body && /<html|<body|<div|<table|<a\s/i.test(raw)) {
      isHtml = true;
      // ambil potongan HTML dari body setelah header
      let htmlPart = body;
      const m = raw.match(/<html[\s\S]*<\/html>/i);
      if (m) htmlPart = m[0];
      else {
        const b = raw.match(/<body[\s\S]*<\/body>/i);
        if (b) htmlPart = b[0];
        else htmlPart = body;
      }
      text = htmlPart;
    } else {
      // plain text: kalau body ternyata punya banyak header, buang
      text = body;
    }

    return {
      subject: msg.mail_subject || "(no subject)",
      from: msg.mail_from || "unknown",
      text: text,
      isHtml: isHtml,
    };
  });
}

function setName(name) {
  const params = { f: "set_email_user", email_user: name, lang: "en" };
  if (state.sid) params.sid_token = state.sid;

  return gapi(params).then(function (d) {
    if (d && d.email_addr) {
      state.address = d.email_addr;
      return d.email_addr;
    }
    return state.address;
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
   MODAL — tampilan seperti Gmail
   =================== */

function linkifyText(text) {
  // escape dulu, lalu jadikan link bisa diklik
  return esc(text)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener" style="color:#8ab4f8;text-decoration:underline">$1</a>'
    )
    .replace(/\n/g, "<br>");
}

function sanitizeHtml(html) {
  // render HTML email, tapi buang script/iframe berbahaya
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
      body =
        '<div class="mail-html">' +
        sanitizeHtml(msg.text) +
        "</div>";
    } else {
      body =
        '<div class="mail-plain">' +
        linkifyText(msg.text) +
        "</div>";
    }

    modalContent.innerHTML = body;
    modal.classList.add("active");

    // paksa link bisa diklik & tombol di dalam HTML email juga bisa diklik
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
    state.saved = JSON.parse(localStorage.getItem("tempmail_saved_v5") || "[]");
  } catch (e) { state.saved = []; }
  renderSaved();
  updateSaveButton();
}

function persistSaved() {
  localStorage.setItem("tempmail_saved_v5", JSON.stringify(state.saved));
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
      sid: state.sid,
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
  if (!found || !found.sid) {
    showToast("tidak bisa dipakai ulang");
    return;
  }

  clearInterval(state.pollId);
  state.sid = found.sid;
  state.address = found.email;
  state.messages = [];

  emailAddressEl.textContent = found.email;
  updateSaveButton();
  renderMessages();
  startPolling();
  refreshMessages(true);
  showToast("email dipakai");
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
  if (!state.address) return Promise.resolve();
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
  state.sid = null;
  state.address = null;
  state.messages = [];

  emailAddressEl.textContent = "loading...";
  mailListEl.innerHTML = "";
  messageNumberEl.textContent = "0";
  mailCountEl.textContent = "0 messages";

  createInbox()
    .then(function () {
      return setName(randomName());
    })
    .then(function (address) {
      emailAddressEl.textContent = address;
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
  newEmailBtn.addEventListener("click", createNewEmail);
  refreshBtn.addEventListener("click", function () { refreshMessages(false); });

  createNewEmail();
}

document.addEventListener("DOMContentLoaded", init);
