/* =========================================================
   Research Desk – frontend for the LangGraph + FastAPI agent

   Backend contract (see main_updated.py):
   POST /chat     { message, thread_id }
   POST /approve  { thread_id, approved }
   Both return either
     { status: "done", reply: "..." }
     { status: "approval_required", approval: { to, subject, body, message } }
   ========================================================= */

const STORE_KEY = "researchdesk.sessions.v1";
const API_KEY = "researchdesk.api";
const DEFAULT_API = "https://research-assistant-f9as.onrender.com";
const NEW_TITLE = "New research";

const $ = (sel) => document.querySelector(sel);
const els = {
  sidebar: $("#sidebar"),
  scrim: $("#scrim"),
  menuBtn: $("#menuBtn"),
  newChat: $("#newChat"),
  history: $("#history"),
  title: $("#chatTitle"),
  status: $("#status"),
  statusText: $("#statusText"),
  stream: $("#stream"),
  messages: $("#messages"),
  composer: $("#composer"),
  input: $("#input"),
  sendBtn: $("#sendBtn"),
  hint: $("#hint"),
  settings: $("#settings"),
  settingsBtn: $("#settingsBtn"),
  settingsForm: $("#settingsForm"),
  apiUrl: $("#apiUrl"),
  toast: $("#toast"),
};

const DEFAULT_HINT = els.hint.textContent;

const SUGGESTIONS = [
  { text: "What are the latest developments in solid-state batteries?", note: "Searches the web and summarises" },
  { text: "Compare LangGraph and CrewAI for building agents", note: "Research with sources" },
  { text: "Research the best free tools for API testing and email me a summary", note: "Research, then draft an email for your approval" },
];

let sessions = loadSessions();
let activeId = null;
let busy = false;

/* ---------- Storage ---------- */
function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveSessions() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(sessions));
  } catch {
    /* storage full or blocked – chat still works for this visit */
  }
}
const apiBase = () => (localStorage.getItem(API_KEY) || DEFAULT_API).replace(/\/+$/, "");

/* ---------- Helpers ---------- */
const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

const active = () => sessions.find((s) => s.id === activeId);
const pendingApproval = (s) => !!s && s.messages.some((m) => m.role === "approval" && m.state === "pending");

function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

/* ---------- Minimal, safe markdown ---------- */
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(text) {
  let t = esc(text);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  t = t.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  );
  return t;
}
function renderMarkdown(src) {
  const lines = String(src).replace(/\r/g, "").split("\n");
  const out = [];
  let para = [];
  let list = null;
  let i = 0;

  const flushPara = () => {
    if (para.length) out.push("<p>" + inline(para.join(" ")) + "</p>");
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const openList = (type) => {
    if (list !== type) {
      closeList();
      out.push(`<${type}>`);
      list = type;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      flushPara();
      closeList();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushPara();
      closeList();
      const lvl = Math.min(m[1].length + 2, 6);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      openList("ul");
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      openList("ol");
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (/^-{3,}$/.test(line.trim())) {
      flushPara();
      closeList();
      out.push("<hr>");
    } else if (!line.trim()) {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(line.trim());
    }
    i++;
  }
  flushPara();
  closeList();
  return out.join("");
}

/* ---------- Rendering ---------- */
function renderHistory() {
  els.history.innerHTML = "";
  if (!sessions.length) {
    const p = document.createElement("p");
    p.className = "history-empty";
    p.textContent = "Your research will appear here.";
    els.history.append(p);
    return;
  }
  [...sessions]
    .sort((a, b) => b.updated - a.updated)
    .forEach((s) => {
      const row = document.createElement("div");
      row.className = "history-item" + (s.id === activeId ? " active" : "");

      const open = document.createElement("button");
      open.className = "history-open";
      open.type = "button";
      open.textContent = s.title;
      open.title = s.title;
      open.addEventListener("click", () => openSession(s.id));

      const del = document.createElement("button");
      del.className = "history-del";
      del.type = "button";
      del.setAttribute("aria-label", `Delete ${s.title}`);
      del.textContent = "×";
      del.addEventListener("click", () => deleteSession(s.id));

      row.append(open, del);
      els.history.append(row);
    });
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderWelcome() {
  const wrap = el("div", "welcome");
  wrap.append(el("h2", "", "What should we look into?"));
  wrap.append(
    el(
      "p",
      "",
      "I search the web, read what I find, and give you a clear summary. Ask me to email it and I will hold the message for your approval first."
    )
  );
  const list = el("div", "prompts");
  SUGGESTIONS.forEach((s) => {
    const b = el("button", "prompt");
    b.type = "button";
    b.append(document.createTextNode(s.text));
    b.append(el("small", "", s.note));
    b.addEventListener("click", () => send(s.text));
    list.append(b);
  });
  wrap.append(list);
  return wrap;
}

function avatar() {
  const a = el("span", "avatar");
  a.setAttribute("aria-hidden", "true");
  return a;
}

function renderAssistant(m) {
  const row = el("div", "msg assistant");
  const body = el("div", "body");
  body.innerHTML = renderMarkdown(m.content);

  const tools = el("div", "msg-tools");
  const copy = el("button", "copy-btn", "Copy");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(m.content);
      toast("Copied to clipboard");
    } catch {
      toast("Copy is not available in this browser");
    }
  });
  tools.append(copy);
  body.append(tools);

  row.append(avatar(), body);
  return row;
}

function renderApproval(m) {
  const row = el("div", "msg");
  const card = el("div", `outbox ${m.state}`);

  const head = el("div", "outbox-head");
  head.append(el("span", "", "Email waiting for your approval"));
  const stampText = { pending: "On hold", sending: "Working", approved: "Approved", rejected: "Not sent" }[m.state] || "On hold";
  head.append(el("span", "stamp", stampText));

  const dl = el("dl", "outbox-body");
  const add = (label, value, cls = "") => {
    const f = el("div", `field ${cls}`);
    f.append(el("dt", "", label), el("dd", "", value || "(empty)"));
    dl.append(f);
  };
  add("To", m.data.to);
  add("Subject", m.data.subject);
  add("Message", m.data.body, "letter");

  card.append(head, dl);

  if (m.state === "pending" || m.state === "sending") {
    const actions = el("div", "outbox-actions");
    const hold = el("button", "btn btn-hold", "Don't send");
    const send = el("button", "btn btn-send", "Send email");
    hold.type = send.type = "button";
    hold.disabled = send.disabled = m.state === "sending";
    hold.addEventListener("click", () => decide(m.id, false));
    send.addEventListener("click", () => decide(m.id, true));
    actions.append(hold, send);
    card.append(actions);
  }

  row.append(card);
  return row;
}

function renderTyping() {
  const t = el("div", "typing");
  t.id = "typing";
  t.append(avatar());
  const dots = el("span", "dots");
  dots.append(el("i"), el("i"), el("i"));
  t.append(dots, el("span", "", "Researching"));
  return t;
}

function render() {
  const s = active();
  els.messages.innerHTML = "";
  els.title.textContent = s ? s.title : NEW_TITLE;

  if (!s || !s.messages.length) {
    els.messages.append(renderWelcome());
  } else {
    s.messages.forEach((m) => {
      if (m.role === "user") {
        const row = el("div", "msg user");
        row.append(el("div", "bubble", m.content));
        els.messages.append(row);
      } else if (m.role === "assistant") {
        els.messages.append(renderAssistant(m));
      } else if (m.role === "approval") {
        els.messages.append(renderApproval(m));
      } else if (m.role === "error") {
        const row = el("div", "msg error");
        row.append(el("div", "body", m.content));
        els.messages.append(row);
      }
    });
  }

  if (busy) els.messages.append(renderTyping());
  updateComposer();
  renderHistory();
  els.stream.scrollTop = els.stream.scrollHeight;
}

function updateComposer() {
  const waiting = pendingApproval(active());
  const locked = busy || waiting;
  els.input.disabled = locked;
  els.sendBtn.disabled = locked || !els.input.value.trim();
  els.input.placeholder = waiting
    ? "Approve or reject the email above to continue"
    : "Ask a question, or ask for research to be emailed";
  els.hint.textContent = waiting ? "The agent is paused until you decide." : DEFAULT_HINT;

  els.status.classList.toggle("busy", busy);
  els.status.classList.toggle("waiting", waiting && !busy);
  els.statusText.textContent = busy ? "Working" : waiting ? "Needs your approval" : "Ready";
}

/* ---------- Sessions ---------- */
function newSession() {
  const s = { id: uid(), title: NEW_TITLE, messages: [], updated: Date.now() };
  sessions.push(s);
  activeId = s.id;
  return s;
}
function openSession(id) {
  activeId = id;
  closeSidebar();
  render();
  if (!els.input.disabled) els.input.focus();
}
function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  saveSessions();
  if (activeId === id) activeId = sessions.length ? sessions[sessions.length - 1].id : null;
  render();
}
function startNew() {
  const current = active();
  if (current && !current.messages.length) {
    closeSidebar();
    els.input.focus();
    return;
  }
  newSession();
  saveSessions();
  closeSidebar();
  render();
  els.input.focus();
}

/* ---------- Talking to the backend ---------- */
function setBusy(value) {
  busy = value;
  render();
}

async function callApi(session, path, body) {
  setBusy(true);
  try {
    const res = await fetch(apiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail || "");
      } catch {
        /* ignore */
      }
      throw new Error(`The server returned ${res.status}. ${detail}`.trim());
    }
    handleResult(session, await res.json());
    return true;
  } catch (err) {
    const offline = err instanceof TypeError;
    session.messages.push({
      id: uid(),
      role: "error",
      content: offline
        ? `Could not reach the server at ${apiBase()}. Check that FastAPI is running and the address in Server settings is correct.`
        : err.message,
    });
    return false;
  } finally {
    session.updated = Date.now();
    saveSessions();
    busy = false;
    render();
  }
}

function handleResult(session, data) {
  if (data.status === "approval_required" && data.approval) {
    session.messages.push({ id: uid(), role: "approval", state: "pending", data: data.approval });
  } else {
    const text = typeof data.reply === "string" ? data.reply : JSON.stringify(data.reply ?? "");
    session.messages.push({ id: uid(), role: "assistant", content: text || "(No response)" });
  }
}

async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  let s = active();
  if (!s) s = newSession();
  if (pendingApproval(s)) return;

  s.messages.push({ id: uid(), role: "user", content: text });
  if (s.title === NEW_TITLE) s.title = text.length > 48 ? text.slice(0, 46) + "…" : text;
  s.updated = Date.now();
  saveSessions();
  els.input.value = "";
  autosize();
  closeSidebar();

  await callApi(s, "/chat", { message: text, thread_id: s.id });
  if (s === active()) els.input.focus();
}

async function decide(messageId, approved) {
  const s = active();
  const m = s && s.messages.find((x) => x.id === messageId);
  if (!m || busy) return;

  m.state = "sending";
  render();

  const ok = await callApi(s, "/approve", { thread_id: s.id, approved });
  m.state = ok ? (approved ? "approved" : "rejected") : "pending";
  saveSessions();
  render();
}

/* ---------- UI wiring ---------- */
function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 180) + "px";
}
function openSidebar() {
  els.sidebar.classList.add("open");
  els.scrim.classList.add("show");
}
function closeSidebar() {
  els.sidebar.classList.remove("open");
  els.scrim.classList.remove("show");
}

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  send(els.input.value);
});
els.input.addEventListener("input", () => {
  autosize();
  updateComposer();
});
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send(els.input.value);
  }
});
els.newChat.addEventListener("click", startNew);
els.menuBtn.addEventListener("click", openSidebar);
els.scrim.addEventListener("click", closeSidebar);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSidebar();
});

els.settingsBtn.addEventListener("click", () => {
  els.apiUrl.value = apiBase();
  els.settings.showModal();
});
els.settingsForm.addEventListener("submit", (e) => {
  if (e.submitter && e.submitter.value === "save" && els.apiUrl.value.trim()) {
    localStorage.setItem(API_KEY, els.apiUrl.value.trim());
    toast("Server address saved");
  }
});

/* ---------- Boot ---------- */
(function init() {
  // An approval that was mid-request when the page closed is safe to show as pending again.
  sessions.forEach((s) =>
    s.messages.forEach((m) => {
      if (m.role === "approval" && m.state === "sending") m.state = "pending";
    })
  );
  if (sessions.length) activeId = [...sessions].sort((a, b) => b.updated - a.updated)[0].id;
  render();
  els.input.focus();
})();
