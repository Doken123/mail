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
  pollInterval: null,
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
   API
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
          <span>${escape
