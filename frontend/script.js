// Uses your local backend when opened from your computer, the live one otherwise
const API_BASE = ["localhost", "127.0.0.1", ""].includes(location.hostname)
  ? "http://127.0.0.1:8000"
  : "https://nova-decision-agent.onrender.com";
const USER_ID = 2;
let history = [];

const $ = id => document.getElementById(id);
const chat = $("chat"), input = $("input"), sendBtn = $("send"),
      fileInput = $("file"), statusEl = $("status");

// ---------- helpers ----------
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function short(t, n = 220) {
  t = String(t || "");
  return t.length > n ? t.slice(0, n).trim() + "…" : t;
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/\[(Doc:[^\]]+|Past decision #\d+)\]/g, '<span class="cite">$1</span>');
}
// tiny, safe markdown renderer (escapes HTML first)
function md(text) {
  const lines = esc(text).split("\n");
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of lines) {
    let m;
    if ((m = line.match(/^#{1,4}\s+(.*)/))) {
      close(); html += `<h4>${inline(m[1])}</h4>`;
    } else if ((m = line.match(/^\s*[*-]\s+(.*)/))) {
      if (list !== "ul") { close(); html += "<ul>"; list = "ul"; }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== "ol") { close(); html += "<ol>"; list = "ol"; }
      html += `<li>${inline(m[1])}</li>`;
    } else if (/^\s*---+\s*$/.test(line)) {
      close(); html += "<hr>";
    } else if (line.trim() !== "") {
      close(); html += `<p>${inline(line)}</p>`;
    }
  }
  close();
  return html;
}

// every request carries a random visitor id (the free plan counts messages per visitor)
const visitorId = (() => {
  try {
    let v = localStorage.getItem("nova_vid");
    if (!v) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
      localStorage.setItem("nova_vid", v);
    }
    return v;
  } catch (e) { return "anon"; }
})();

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}), "X-Visitor-Id": visitorId };
  const res = await fetch(+ path, { ...options, headers });

  const used = res.headers.get("X-Usage-Used");
  const limit = res.headers.get("X-Usage-Limit");
  if (used !== null && limit !== null) showUsage(Number(used), Number(limit));

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const d = data && data.detail;
    throw new Error(d ? (typeof d === "string" ? d : JSON.stringify(d)) : `HTTP ${res.status}`);
  }
  return data;
}
const post = (path, body) => api(path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ---------- dashboard ----------
function renderDashboard(d) {
  $("userChip").textContent = "👤 " + d.user.name;
  const hello = $("hello");
  if (hello) {
    const h = new Date().getHours();
    hello.textContent = `Good ${h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"}, ${d.user.name} 👋`;
  }
  $("statGoals").textContent = d.stats.goals;
  $("statConstraints").textContent = d.stats.constraints;
  $("statDecisions").textContent = d.stats.decisions;
  $("statDocs").textContent = d.stats.documents;

  $("goalsList").innerHTML = d.goals.length
    ? d.goals.map(g => `<div class="item">${esc(g.title)}<small>${esc(g.status)}${g.description ? " · " + esc(short(g.description, 70)) : ""}</small></div>`).join("")
    : '<div class="empty">No goals yet.</div>';

  $("constraintsList").innerHTML = d.constraints.length
    ? d.constraints.map(c => `<div class="item"><span class="tag">${esc(c.type || "general")}</span>${esc(c.description)}</div>`).join("")
    : '<div class="empty">No constraints yet.</div>';

  $("docsList").innerHTML = d.documents.length
    ? d.documents.map(x => `<div class="item">📄 ${esc(x.title)}<small>${x.chunks} sections</small></div>`).join("")
    : '<div class="empty">No documents yet. Upload one.</div>';

  renderTimeline(d.decisions);
  renderPlans(d.decisions, d.stats);
}

const CHECKIN_DAYS = 7;

function renderTimeline(decisions) {
  const head = '<button class="mini wide" data-add="decision">+ Log a decision</button>';
  const tabBtn = document.querySelector('[data-tab="timeline"]');

  if (!decisions.length) {
    if (tabBtn) tabBtn.textContent = "Timeline";
    $("tab-timeline").innerHTML = head + '<div class="empty">No decisions logged yet.</div>';
    return;
  }

  const now = Date.now();
  const ageDays = d => d.created_at ? Math.floor((now - new Date(d.created_at).getTime()) / 86400000) : 0;
  const due = decisions.filter(d => !d.outcome && ageDays(d) >= CHECKIN_DAYS);

  if (tabBtn) tabBtn.textContent = due.length ? `Timeline (${due.length})` : "Timeline";

  const banner = due.length
    ? `<div class="card pending"><h5><span>⏰ Check-in time</span></h5><p>${due.length} decision${due.length > 1 ? "s are" : " is"} waiting for an outcome. Recording how they turned out helps NOVA give better advice next time.</p></div>`
    : "";

  $("tab-timeline").innerHTML = head + banner + decisions.map(d => {
    const o = d.outcome;
    const isDue = !o && ageDays(d) >= CHECKIN_DAYS;
    let cls = "pending", badge = '<span class="badge warn">No outcome yet</span>';
    if (isDue) badge = `<span class="badge warn">⏰ Check-in · ${ageDays(d)}d</span>`;
    if (o) {
      if (o.worked === true) { cls = "good"; badge = '<span class="badge good">Worked</span>'; }
      else if (o.worked === false) { cls = "bad"; badge = '<span class="badge bad">Didn\'t work</span>'; }
      else { badge = '<span class="badge warn">Outcome noted</span>'; }
    }
    const tasks = d.actions || [];
    const doneCount = tasks.filter(a => a.status === "done").length;
    return `<div class="card ${cls}">
      <h5><span>${esc(d.question)}</span>${badge}</h5>
      ${d.chosen_option ? `<p>Chose: ${esc(d.chosen_option)}</p>` : ""}
      ${tasks.length ? `<p class="meta">📌 ${doneCount}/${tasks.length} tasks done</p>` : ""}
      ${o ? `<p class="meta">Result: ${esc(short(o.text, 140))}</p>`
          : `<button class="mini" data-outcome="${d.id}">${isDue ? "Record outcome now" : "Record outcome"}</button>`}
      <div class="meta">${esc(fmtDate(d.created_at))} · ${esc(d.status)}</div>
    </div>`;
  }).join("");
}

function renderPlans(decisions, stats) {
  const plans = decisions.filter(d => d.actions && d.actions.length);
  if (!plans.length) {
    $("tab-plans").innerHTML = '<div class="empty">No plans yet. When NOVA gives you a plan or a decision, click <b>📌 Save as plan</b> under the answer. Its steps will appear here as tasks you can tick off.</div>';
    return;
  }
  const total = stats.tasks_total || 0, doneAll = stats.tasks_done || 0;
  const pct = total ? Math.round((doneAll / total) * 100) : 0;
  let html = `<div class="progress-card">
      <div class="progress-top"><b>${doneAll} of ${total} tasks done</b><span>${pct}%</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>`;
  html += plans.map(d => {
    const doneCount = d.actions.filter(a => a.status === "done").length;
    const complete = doneCount === d.actions.length;
    return `<div class="plan ${complete ? "complete" : ""}">
      <h5><span>${esc(d.chosen_option || d.question)}</span>${complete ? '<span class="badge good">Completed 🎉</span>' : `<span class="meta">${doneCount}/${d.actions.length}</span>`}</h5>
      <div class="sub">${esc(short(d.question, 110))}</div>
      ${d.actions.map(a => `<label class="task ${a.status === "done" ? "done" : ""}">
        <input type="checkbox" data-task="${a.id}" ${a.status === "done" ? "checked" : ""}>
        <span>${esc(a.description)}</span></label>`).join("")}
    </div>`;
  }).join("");
  $("tab-plans").innerHTML = html;
}

async function loadDashboard() {
  try {
    renderDashboard(await api(`/dashboard/${USER_ID}`));
  } catch (e) {
    $("goalsList").innerHTML = '<div class="empty">Could not load your data.</div>';
  }
}

// ---------- evidence panel ("Why NOVA said this") ----------
const EVIDENCE_EMPTY =
  '<div class="empty">Ask NOVA a question. This panel shows <b>why NOVA said it</b>: the memories and document passages it used, so you can check where every answer comes from.</div>';
$("tab-evidence").innerHTML = EVIDENCE_EMPTY;

function renderEvidence(data) {
  const mems = data.memories_used || [], docs = data.documents_used || [];
  if (!mems.length && !docs.length) {
    $("tab-evidence").innerHTML = '<div class="empty">No stored memories or documents were needed for this reply.</div>';
    return;
  }
  let html = '<div class="empty"><b>Why NOVA said this:</b> it used these from your memory to write the answer.</div>';
  mems.forEach(m => {
    const label = m.source_table === "feedback" ? "Outcome of decision" : "Past decision";
    html += `<div class="card"><h5><span>🧠 ${label} #${m.source_id}</span><span class="meta">distance ${m.distance}</span></h5><p>${esc(short(String(m.summary_text).replace(/\n/g, " · "), 240))}</p></div>`;
  });
  docs.forEach(d => {
    html += `<div class="card"><h5><span>📄 ${esc(d.title)} · part ${d.chunk_index}</span><span class="meta">distance ${d.distance}</span></h5><p>${esc(short(d.chunk_text, 240))}</p></div>`;
  });
  html += '<div class="empty">Lower distance means a closer match. If something here looks unrelated, NOVA should ignore it.</div>';
  $("tab-evidence").innerHTML = html;
}

function showTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  ["evidence", "timeline", "plans"].forEach(n => $("tab-" + n).classList.toggle("hidden", n !== name));
}
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

// ---------- chat ----------
function addMsg(kind, html) {
  if (kind === "user") {
    // like ChatGPT and Claude: starter questions only show on an empty chat
    const s = document.querySelector(".suggestions");
    if (s) s.classList.add("hidden");
  }
  const div = document.createElement("div");
  div.className = `msg ${kind}`;
  div.innerHTML = html;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function autosize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

async function ask(question) {
  question = question.trim();
  if (!question || sendBtn.disabled) return;

  addMsg("user", esc(question));
  input.value = "";
  autosize();
  sendBtn.disabled = true;

  const typing = addMsg("bot typing", "Thinking…");
  const hint = setTimeout(() => {
    typing.textContent = "Still working… the first message can take up to a minute while the server wakes up.";
  }, 8000);

  try {
    const data = await post("/advisor/ask-graph", { user_id: USER_ID, question, history: history.slice(-8) });
    history.push({ role: "user", content: question }, { role: "assistant", content: data.answer });
    typing.className = "msg bot";
    typing.innerHTML = md(data.answer);

    // offer "Save as plan" for longer answers that are not just clarifying questions
    const questionMarks = (data.answer.match(/\?/g) || []).length;
    if (data.answer.length > 300 && questionMarks < 3) {
      typing.dataset.question = question;
      typing.dataset.answer = data.answer;
      typing.insertAdjacentHTML("beforeend",
        '<div class="msg-actions"><button class="mini" data-saveplan="1">📌 Save as plan</button></div>');
    }
    renderEvidence(data);
    showTab("evidence");
  } catch (e) {
    typing.className = "msg bot";
        typing.innerHTML = "<p>Sorry, I couldn't get an answer. " + (/limit/i.test(e.message || "") ? esc(e.message) : "The AI service may be busy. Please try again in a minute.") + "</p>";
  } finally {
    clearTimeout(hint);
    sendBtn.disabled = false;
    chat.scrollTop = chat.scrollHeight;
    input.focus();
  }
}

input.addEventListener("input", autosize);
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); }
});
sendBtn.addEventListener("click", () => ask(input.value));
document.querySelectorAll(".suggestions button").forEach(b =>
  b.addEventListener("click", () => ask(b.textContent))
);

// ---------- save an answer as a plan ----------
async function savePlan(btn) {
  const msg = btn.closest(".msg");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const plan = await post("/plans/from-answer", {
      user_id: USER_ID,
      question: msg.dataset.question,
      answer: msg.dataset.answer,
    });
    btn.textContent = `✅ Saved: ${plan.actions.length} tasks`;
    await loadDashboard();
    showTab("plans");
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "📌 Save as plan";
    addMsg("sys", `⚠️ Couldn't save the plan: ${esc(e.message || e)}`);
  }
}

// tick / untick a task
document.addEventListener("change", async e => {
  const cb = e.target.closest ? e.target.closest("[data-task]") : null;
  if (!cb) return;
  cb.disabled = true;
  try {
    await api(`/plans/actions/${cb.dataset.task}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: cb.checked ? "done" : "todo" }),
    });
    await loadDashboard();
  } catch (err) {
    cb.checked = !cb.checked;
    cb.disabled = false;
  }
});

// ---------- upload a document ----------
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  addMsg("sys", `Uploading ${esc(file.name)}…`);
  const form = new FormData();
  form.append("user_id", USER_ID);
  form.append("file", file);
  try {
    const data = await api("/documents/upload", { method: "POST", body: form });
    addMsg("sys", `✅ ${esc(data.title)} added (${data.chunks} sections). You can ask me about it now.`);
    loadDashboard();
  } catch (e) {
    addMsg("sys", `⚠️ Upload failed: ${esc(e.message || e)}`);
  }
  fileInput.value = "";
});

// ---------- add / log forms (modal) ----------
const FORMS = {
  goal: {
    title: "Add a goal", url: "/goals/",
    fields: [
      { name: "title", label: "Goal", type: "text", required: true, placeholder: "e.g. Become a GenAI engineer" },
      { name: "description", label: "Details (optional)", type: "textarea" },
    ],
  },
  constraint: {
    title: "Add a constraint", url: "/constraints/",
    fields: [
      { name: "description", label: "Constraint", type: "text", required: true, placeholder: "e.g. Must earn at least my current salary" },
      { name: "type", label: "Type", type: "select", options: ["budget", "time", "personal", "ethical"] },
    ],
  },
  decision: {
    title: "Log a decision", url: "/decisions/",
    fields: [
      { name: "question", label: "What were you deciding?", type: "text", required: true },
      { name: "reasoning", label: "Why? (your reasoning)", type: "textarea" },
      { name: "chosen_option", label: "What did you choose?", type: "text" },
    ],
  },
  outcome: {
    title: "Record the outcome", url: "/feedback",
    fields: [
      { name: "outcome", label: "What happened?", type: "textarea", required: true },
      { name: "worked_as_expected", label: "Did it work out?", type: "select",
        options: [["true", "Yes"], ["false", "No"], ["", "Not sure"]] },
    ],
  },
};

let modalCtx = null;

function openModal(type, extra) {
  const f = FORMS[type];
  modalCtx = { type, extra: extra || {} };
  $("modalTitle").textContent = f.title;
  $("modalError").textContent = "";
  $("modalFields").innerHTML = f.fields.map(fl => {
    const ph = fl.placeholder ? ` placeholder="${esc(fl.placeholder)}"` : "";
    let control;
    if (fl.type === "textarea") {
      control = `<textarea name="${fl.name}" rows="3"${ph}></textarea>`;
    } else if (fl.type === "select") {
      control = `<select name="${fl.name}">${fl.options.map(o => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}">${esc(l)}</option>`;
      }).join("")}</select>`;
    } else {
      control = `<input type="text" name="${fl.name}"${ph}>`;
    }
    return `<label class="field"><span>${esc(fl.label)}</span>${control}</label>`;
  }).join("");
  $("modal").classList.remove("hidden");
  const first = $("modalFields").querySelector("input,textarea,select");
  if (first) first.focus();
}
function closeModal() { $("modal").classList.add("hidden"); modalCtx = null; }

$("modalCancel").addEventListener("click", closeModal);
$("modal").addEventListener("click", e => { if (e.target === $("modal")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

$("modalSave").addEventListener("click", async () => {
  if (!modalCtx) return;
  const { type, extra } = modalCtx;
  const f = FORMS[type];
  const body = { ...extra };
  for (const fl of f.fields) {
    const el = $("modalFields").querySelector(`[name="${fl.name}"]`);
    const v = el.value.trim();
    if (fl.required && !v) { $("modalError").textContent = `Please fill in: ${fl.label}`; return; }
    body[fl.name] = v;
  }
  if (type === "outcome") {
    body.worked_as_expected = body.worked_as_expected === "" ? null : body.worked_as_expected === "true";
  }
  $("modalSave").disabled = true;
  $("modalSave").textContent = "Saving…";
  try {
    await post(f.url, body);
    closeModal();
    await loadDashboard();
  } catch (e) {
    $("modalError").textContent = "Couldn't save: " + e.message;
  } finally {
    $("modalSave").disabled = false;
    $("modalSave").textContent = "Save";
  }
});

document.addEventListener("click", e => {
  const save = e.target.closest("[data-saveplan]");
  if (save) { savePlan(save); return; }
  const add = e.target.closest("[data-add]");
  if (add) { openModal(add.dataset.add, { user_id: USER_ID }); return; }
  const out = e.target.closest("[data-outcome]");
  if (out) { openModal("outcome", { decision_id: Number(out.dataset.outcome) }); }
});

// ---------- server status (also wakes the free server) ----------
async function pingServer() {
  try {
    const d = await api("/health");
    if (d.status === "ok") {
      statusEl.textContent = "Online";
      statusEl.classList.add("ok");
      loadDashboard();
      return;
    }
  } catch (e) { /* server still waking up */ }

  statusEl.textContent = "Waking up…";
  setTimeout(pingServer, 5000);
}

// ---------- start ----------
addMsg("bot", md(
  "Hi, I'm **NOVA**, your personal decision assistant.\n\n" +
  "I remember your goals, constraints and past decisions, and I can read documents you upload. " +
  "Ask me about a decision, or try one of the suggestions below."
));
pingServer();
// ---------- pre-mortem: NOVA argues against a decision ----------
const premortemBtn = $("premortem");

async function runPremortem() {
  const text = input.value.trim();
  if (!text) {
    addMsg("sys", "Type the decision you are about to make first, then click Pre-mortem.");
    return;
  }
  if (sendBtn.disabled) return;

  addMsg("user", "🔍 Pre-mortem: " + esc(text));
  input.value = "";
  autosize();
  sendBtn.disabled = true;
  premortemBtn.disabled = true;

  const typing = addMsg("bot typing", "Looking for how this could go wrong…");
  try {
    const data = await post("/premortem/", { user_id: USER_ID, decision: text });
    history.push(
      { role: "user", content: "Pre-mortem of my decision: " + text },
      { role: "assistant", content: data.answer }
    );
    typing.className = "msg bot";
    typing.innerHTML = md(data.answer);

    const tr = data.track_record;
    if (tr) {
      addMsg("sys", `Your track record: ${tr.worked} worked · ${tr.didnt} didn't · ${tr.waiting} still waiting for an outcome`);
    }
    renderEvidence(data);
    showTab("evidence");
  } catch (e) {
    typing.className = "msg bot";
       typing.innerHTML = "<p>Sorry, I couldn't run the pre-mortem.</p><p>" + esc(e.message || e) + "</p>";
  } finally {
    sendBtn.disabled = false;
    premortemBtn.disabled = false;
    chat.scrollTop = chat.scrollHeight;
    input.focus();
  }
}
premortemBtn.addEventListener("click", runPremortem);
// ---------- decision patterns ----------
const MIN_OUTCOMES = 3;
let lastInsight = "";

function patternStats(decisions) {
  const total = decisions.length;
  const withOutcome = decisions.filter(d => d.outcome);
  const worked = withOutcome.filter(d => d.outcome.worked === true).length;
  const didnt = withOutcome.filter(d => d.outcome.worked === false).length;
  const usable = withOutcome.filter(d => String(d.outcome.text || "").trim().split(/\s+/).length >= 4).length;
  let tasks = 0, tasksDone = 0;
  decisions.forEach(d => (d.actions || []).forEach(a => { tasks++; if (a.status === "done") tasksDone++; }));
  return { total, worked, didnt, waiting: total - withOutcome.length, usable, tasks, tasksDone };
}

function patternsCard(decisions) {
  const s = patternStats(decisions);
  const decided = s.worked + s.didnt;
  const rate = decided >= 3 ? Math.round((s.worked / decided) * 100) + "%" : "–";
  const taskPct = s.tasks ? Math.round((s.tasksDone / s.tasks) * 100) + "%" : "–";
  const ready = s.usable >= MIN_OUTCOMES;
  const hint = ready ? "" : `<div class="empty">AI insights unlock at ${MIN_OUTCOMES} outcomes written in full sentences. You have ${s.usable}.</div>`;
  return `<div class="card">
    <h5><span>📊 Your decision record</span></h5>
    <div class="mini-stats">
      <div><b>${s.total}</b><small>logged</small></div>
      <div><b>${s.worked}</b><small>worked</small></div>
      <div><b>${s.didnt}</b><small>didn't</small></div>
      <div><b>${s.waiting}</b><small>waiting</small></div>
    </div>
    <p class="meta">Success rate: ${rate}${rate === "–" ? " (needs 3 outcomes marked yes or no)" : ""} · Plan tasks done: ${s.tasksDone}/${s.tasks} (${taskPct})</p>
    <button class="mini wide" data-insights="1" ${ready ? "" : "disabled"}>✨ AI insights</button>
    ${hint}
    <div id="insightText">${lastInsight ? md(lastInsight) : ""}</div>
  </div>`;
}

// wrap the timeline so the record card appears at the top
const originalRenderTimeline = renderTimeline;
renderTimeline = function (decisions) {
  originalRenderTimeline(decisions);
  $("tab-timeline").insertAdjacentHTML("afterbegin", patternsCard(decisions));
};

document.addEventListener("click", async e => {
  const btn = e.target.closest("[data-insights]");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Thinking…";
  try {
    const data = await post(`/insights/${USER_ID}`, {});
    lastInsight = data.answer;
  } catch (err) {
    lastInsight = "Couldn't get insights: " + (err.message || err);
  }
  await loadDashboard();
});
// ---------- profile + demo mode (chosen in the backend settings) ----------
let profileTries = 0;

async function applyProfile() {
  try {
    const p = await api("/profiles/active");
    document.title = "NOVA " + p.subtitle;

    const sub = document.querySelector(".brand p");
    if (sub) sub.textContent = p.subtitle;

    const labels = document.querySelectorAll(".block-head h3");
    if (labels[0]) labels[0].textContent = p.goals_label;
    if (labels[1]) labels[1].textContent = p.constraints_label;
    if (labels[2]) labels[2].textContent = p.documents_label;

    document.querySelectorAll(".suggestions button").forEach((b, i) => {
      if (p.suggestions[i]) b.textContent = p.suggestions[i];
    });

    const first = document.querySelector("#chat .msg.bot");
    if (first && history.length === 0) first.innerHTML = md(p.welcome);

    if (p.demo_mode) {
      document.body.classList.add("demo");
      if (!document.querySelector(".demo-banner")) {
        document.querySelector(".topbar").insertAdjacentHTML("afterend",
          '<div class="demo-banner">🔒 Public demo: read-only with sample data. AI replies are limited to a few messages a day. Please do not enter personal or confidential information.</div>');
      }
    }
  } catch (e) {
    // the server may still be waking up, so try again a few times
    if (++profileTries < 12) setTimeout(applyProfile, 5000);
  }
}
applyProfile();
// ---------- free plan usage meter ----------
function resetTimeText() {
  // the daily count resets at midnight UTC; show that moment in the visitor's own time
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function showUsage(used, limit) {  
  const el = $("usage");
  if (!el || !limit) return;
  const left = Math.max(0, limit - used);
  const pct = Math.min(100, Math.round((used / limit) * 100));

  // like ChatGPT and Claude: stay quiet until the limit is close
  if (left > 3) { el.classList.add("hidden"); return; }

  el.classList.remove("hidden");
  el.classList.toggle("empty", left === 0);
  const text = left === 0
    ? `You've used today's free messages. They reset at ${resetTimeText()}.`
    : `<b>${left}</b> free message${left === 1 ? "" : "s"} left today. Resets at ${resetTimeText()}.`;
  el.innerHTML =
    `<div class="usage-top"><span>${text}</span><a href="index.html#plans">Go Pro (soon)</a></div>` +
    `<div class="bar"><i style="width:${pct}%"></i></div>`;
}

let usageTries = 0;
function loadUsage() {
  api("/usage").catch(() => { if (++usageTries < 12) setTimeout(loadUsage, 5000); });
}
loadUsage();
// ---------- Decision Lab ----------
const labBtn = $("labBtn"), labMenu = $("labMenu");
const LAB_TITLES = { flip: "What would change my mind?", voices: "Three voices", tenx: "10-10-10" };

labBtn.addEventListener("click", e => { e.stopPropagation(); labMenu.classList.toggle("hidden"); });
document.addEventListener("click", () => labMenu.classList.add("hidden"));

async function runLab(mode) {
  labMenu.classList.add("hidden");
  const text = input.value.trim();
  if (!text) {
    addMsg("sys", "Type the decision you are thinking about first, then pick a Lab tool.");
    return;
  }
  if (sendBtn.disabled) return;

  addMsg("user", `🧪 ${LAB_TITLES[mode]}: ${esc(text)}`);
  input.value = "";
  autosize();
  sendBtn.disabled = true;
  premortemBtn.disabled = true;
  labBtn.disabled = true;

  const typing = addMsg("bot typing", "Working on it…");
  try {
    const data = await post("/lab/", { user_id: USER_ID, decision: text, mode });
    history.push(
      { role: "user", content: `${LAB_TITLES[mode]} for my decision: ${text}` },
      { role: "assistant", content: data.answer }
    );
    typing.className = "msg bot";
    typing.innerHTML = md(data.answer);
    renderEvidence(data);
    showTab("evidence");
  } catch (e) {
    typing.className = "msg bot";
    typing.innerHTML = "<p>Sorry, the Lab couldn't run.</p><p>" + esc(e.message || e) + "</p>";
  } finally {
    sendBtn.disabled = false;
    premortemBtn.disabled = false;
    labBtn.disabled = false;
    chat.scrollTop = chat.scrollHeight;
    input.focus();
  }
}
document.querySelectorAll("[data-lab]").forEach(b => b.addEventListener("click", () => runLab(b.dataset.lab)));
// ---------- polish pass ----------

// 1) Evidence: show only the sources the answer actually cites
function citedSources(answer) {
  const text = String(answer || "");
  const memIds = new Set();
  for (const m of text.matchAll(/Past decision #(\d+)/g)) memIds.add(Number(m[1]));
  const docParts = new Set();
  for (const m of text.matchAll(/Doc:\s*(.+?),\s*parts?\s*([0-9][0-9,\sand]*)/g)) {
    (m[2].match(/\d+/g) || []).forEach(n => docParts.add(m[1].trim() + "|" + n));
  }
  return { memIds, docParts };
}

renderEvidence = function (data) {
  const mems = data.memories_used || [], docs = data.documents_used || [];
  const { memIds, docParts } = citedSources(data.answer);

  const isUsedMem = m => memIds.has(Number(m.source_id));
  const isUsedDoc = d => docParts.has(d.title + "|" + d.chunk_index);

  const memCard = m => {
    const label = m.source_table === "feedback" ? "Outcome of decision" : "Past decision";
    return `<div class="card"><h5><span>🧠 ${label} #${m.source_id}</span><span class="meta">distance ${m.distance}</span></h5><p>${esc(short(String(m.summary_text).replace(/\n/g, " · "), 240))}</p></div>`;
  };
  const docCard = d =>
    `<div class="card"><h5><span>📄 ${esc(d.title)} · part ${d.chunk_index}</span><span class="meta">distance ${d.distance}</span></h5><p>${esc(short(d.chunk_text, 240))}</p></div>`;

  const usedMems = mems.filter(isUsedMem), otherMems = mems.filter(m => !isUsedMem(m));
  const usedDocs = docs.filter(isUsedDoc), otherDocs = docs.filter(d => !isUsedDoc(d));

  let html;
  if (!usedMems.length && !usedDocs.length) {
    html = '<div class="empty"><b>Why NOVA said this:</b> no past decisions or documents were cited in this answer.</div>';
  } else {
    html = '<div class="empty"><b>Why NOVA said this:</b> it used these from your memory.</div>' +
      usedMems.map(memCard).join("") + usedDocs.map(docCard).join("");
  }
  const rest = otherMems.length + otherDocs.length;
  if (rest) {
    html += `<details class="also"><summary>Also searched, not used (${rest})</summary>` +
      otherMems.map(memCard).join("") + otherDocs.map(docCard).join("") + "</details>";
  }
  $("tab-evidence").innerHTML = html;
};

// 2) "Save as plan" only on answers that look like a plan or a decision
function looksLikePlan(answer) {
  const a = String(answer || "");
  const items = (a.match(/^\s*(?:\d+[.)]|[*-])\s+/gm) || []).length;
  const questionMarks = (a.match(/\?/g) || []).length;
  const planWords = /(next actions?|recommendation|verdict|action plan|roadmap|timeline|week\s*\d|month\s*\d|phase\s*\d)/i.test(a);
  return a.length > 300 && items >= 3 && questionMarks < 3 && planWords;
}

new MutationObserver(() => {
  document.querySelectorAll(".msg-actions").forEach(box => {
    const msg = box.closest(".msg");
    if (msg && !looksLikePlan(msg.dataset.answer)) box.remove();
  });
}).observe($("chat"), { childList: true, subtree: true });

// 3) Pre-mortem moves into the Lab menu
(function () {
  const menu = $("labMenu");
  if (menu && !menu.querySelector('[data-lab="premortem"]')) {
    menu.insertAdjacentHTML("afterbegin",
      '<button type="button" data-lab="premortem">😈 Pre-mortem<small>Imagine it failed in 6 months, and why</small></button>');
    menu.querySelector('[data-lab="premortem"]').addEventListener("click", () => runLab("premortem"));
  }
  input.placeholder = "Ask NOVA, or type a decision and open Lab…";
})();

const runLabOriginal = runLab;
runLab = function (mode) {
  if (mode === "premortem") { labMenu.classList.add("hidden"); return runPremortem(); }
  return runLabOriginal(mode);
};
// ---------- new layout: slide-over panels, welcome screen, source chips ----------
const memoryDrawer = $("memoryDrawer"), insightsDrawer = $("insightsDrawer"), scrim = $("scrim");

function closeDrawers() {
  [memoryDrawer, insightsDrawer].forEach(d => d.classList.remove("open"));
  scrim.classList.add("hidden");
}
function openDrawer(d) {
  closeDrawers();
  d.classList.add("open");
  scrim.classList.remove("hidden");
}
$("openMemory").addEventListener("click", () => openDrawer(memoryDrawer));
$("openInsights").addEventListener("click", () => openDrawer(insightsDrawer));
scrim.addEventListener("click", closeDrawers);
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeDrawers));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawers(); });

// the welcome screen disappears after the first message
const addMsgBeforeLayout = addMsg;
addMsg = function (kind, html) {
  if (kind === "user") {
    const e = $("emptyState");
    if (e) e.classList.add("hidden");
  }
  return addMsgBeforeLayout(kind, html);
};

// source chips under each answer open the Insights panel
const renderEvidenceBeforeLayout = renderEvidence;
renderEvidence = function (data) {
  renderEvidenceBeforeLayout(data);
  const { memIds, docParts } = citedSources(data.answer);
  const chips = [];
  (data.documents_used || []).forEach(d => {
    if (docParts.has(d.title + "|" + d.chunk_index)) {
      chips.push(`📄 ${esc(d.title.replace(/\.[^.]+$/, ""))} · part ${d.chunk_index}`);
    }
  });
  (data.memories_used || []).forEach(m => {
    if (memIds.has(Number(m.source_id))) {
      chips.push(`🧠 ${m.source_table === "feedback" ? "Outcome" : "Decision"} #${m.source_id}`);
    }
  });
  const searched = (data.memories_used || []).length + (data.documents_used || []).length;
  if (!chips.length && !searched) return;

  const bots = document.querySelectorAll("#chat .msg.bot");
  const last = bots[bots.length - 1];
  if (!last || last.querySelector(".msg-sources")) return;
  last.insertAdjacentHTML("beforeend",
    '<div class="msg-sources">' +
    chips.slice(0, 5).map(c => `<button class="chip-btn" data-open-insights="1" type="button">${c}</button>`).join("") +
    '<button class="chip-btn" data-open-insights="1" type="button">🔎 Why this answer</button></div>');
};

document.addEventListener("click", e => {
  if (e.target.closest("[data-open-insights]")) { showTab("evidence"); openDrawer(insightsDrawer); }
});

// after saving a plan, show it
const savePlanBeforeLayout = savePlan;
savePlan = async function (btn) {
  await savePlanBeforeLayout(btn);
  showTab("plans");
  openDrawer(insightsDrawer);
};
// ---------- conversations: new chat, history, starter cards ----------
const CHATS_KEY = "nova_chats_v1";
let currentChatId = null;
let saveTimer = null;

function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHATS_KEY) || "[]"); } catch (e) { return []; }
}
function storeChats(list) {
  try { localStorage.setItem(CHATS_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) { /* storage full or blocked */ }
}
function chatTitle() {
  const u = chat.querySelector(".msg.user");
  const t = (u ? u.textContent : "New chat").replace(/\s+/g, " ").trim();
  return t.length > 46 ? t.slice(0, 46) + "…" : t;
}

function renderChatList() {
  const el = $("chatList");
  if (!el) return;
  const list = loadChats();
  if (!list.length) {
    el.innerHTML = '<div class="empty">No conversations yet. Start one and it will appear here.</div>';
    return;
  }
  el.innerHTML = list.map(c =>
    `<div class="chat-item ${c.id === currentChatId ? "active" : ""}" data-chat="${esc(c.id)}">
      <span class="chat-title">${esc(c.title)}</span>
      <small>${esc(new Date(c.updated).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}</small>
      <button class="chat-del" data-chat-del="${esc(c.id)}" type="button" title="Delete">🗑</button>
    </div>`).join("");
}

function saveCurrentChat() {
  // save only finished conversations (not while NOVA is still typing)
  if (!chat.querySelector(".msg.user") || chat.querySelector(".msg.typing")) return;
  const list = loadChats();
  if (!currentChatId) currentChatId = "c" + Date.now();
  const record = {
    id: currentChatId, title: chatTitle(), updated: Date.now(),
    chatHTML: chat.innerHTML, evidenceHTML: $("tab-evidence").innerHTML, history,
  };
  const i = list.findIndex(c => c.id === currentChatId);
  if (i >= 0) list.splice(i, 1);
  list.unshift(record);
  storeChats(list);
  renderChatList();
}

// save a moment after anything changes in the chat
new MutationObserver(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentChat, 700);
}).observe(chat, { childList: true, subtree: true, characterData: true, attributes: true });

function newChat() {
  if (sendBtn.disabled) return;           // NOVA is still answering
  saveCurrentChat();
  currentChatId = null;
  history = [];
  chat.innerHTML = "";
  $("tab-evidence").innerHTML = EVIDENCE_EMPTY;
  const e = $("emptyState");
  if (e) e.classList.remove("hidden");
  input.value = "";
  autosize();
  closeDrawers();
  renderChatList();
  input.focus();
}

function openChat(id) {
  if (sendBtn.disabled) return;
  const c = loadChats().find(x => x.id === id);
  if (!c) return;
  saveCurrentChat();
  currentChatId = c.id;
  history = c.history || [];
  chat.innerHTML = c.chatHTML;
  $("tab-evidence").innerHTML = c.evidenceHTML || EVIDENCE_EMPTY;
  const e = $("emptyState");
  if (e) e.classList.add("hidden");
  closeDrawers();
  chat.scrollTop = chat.scrollHeight;
  renderChatList();
}

function deleteChat(id) {
  storeChats(loadChats().filter(c => c.id !== id));
  if (id === currentChatId) newChat(); else renderChatList();
}

function showMenuTab(name) {
  document.querySelectorAll("[data-menu]").forEach(b => b.classList.toggle("active", b.dataset.menu === name));
  $("paneChats").classList.toggle("hidden", name !== "chats");
  $("paneMemory").classList.toggle("hidden", name !== "memory");
}

$("newChat").addEventListener("click", newChat);
$("newChat2").addEventListener("click", newChat);
$("openMemory").addEventListener("click", () => { showMenuTab("chats"); renderChatList(); });
document.querySelectorAll("[data-menu]").forEach(b => b.addEventListener("click", () => showMenuTab(b.dataset.menu)));

document.addEventListener("click", e => {
  const del = e.target.closest("[data-chat-del]");
  if (del) {
    e.stopPropagation();
    if (confirm("Delete this conversation?")) deleteChat(del.dataset.chatDel);
    return;
  }
  const item = e.target.closest("[data-chat]");
  if (item) openChat(item.dataset.chat);
});

// starter cards start the sentence in the box; they do not send anything
document.querySelectorAll(".starter").forEach(b => b.addEventListener("click", () => {
  input.value = b.dataset.fill;
  autosize();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}));

renderChatList();
// ---------- chat menu: rename, pin, delete (like ChatGPT) ----------

// save keeps a custom title and the pin when the chat continues
saveCurrentChat = function () {
  if (!chat.querySelector(".msg.user") || chat.querySelector(".msg.typing")) return;
  const list = loadChats();
  if (!currentChatId) currentChatId = "c" + Date.now();
  const old = list.find(c => c.id === currentChatId) || {};
  const record = {
    id: currentChatId,
    title: old.custom ? old.title : chatTitle(),
    custom: !!old.custom,
    pinned: !!old.pinned,
    updated: Date.now(),
    chatHTML: chat.innerHTML,
    evidenceHTML: $("tab-evidence").innerHTML,
    history,
  };
  storeChats([record, ...list.filter(c => c.id !== currentChatId)]);
  renderChatList();
};

// list: pinned chats first, then newest, each with a ⋯ button
renderChatList = function () {
  const el = $("chatList");
  if (!el) return;
  const list = loadChats().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
  if (!list.length) {
    el.innerHTML = '<div class="empty">No conversations yet. Start one and it will appear here.</div>';
    return;
  }
  el.innerHTML = list.map(c =>
    `<div class="chat-item ${c.id === currentChatId ? "active" : ""}" data-chat="${esc(c.id)}">
      <span class="chat-title">${c.pinned ? "📌 " : ""}${esc(c.title)}</span>
      <small>${esc(new Date(c.updated).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}</small>
      <button class="chat-more" data-chat-more="${esc(c.id)}" type="button" title="More">⋯</button>
    </div>`).join("");
};

let chatMenuEl = null;
function closeChatMenu() { if (chatMenuEl) { chatMenuEl.remove(); chatMenuEl = null; } }

function openChatMenu(id, anchor) {
  closeChatMenu();
  const c = loadChats().find(x => x.id === id);
  if (!c) return;
  const r = anchor.getBoundingClientRect();
  chatMenuEl = document.createElement("div");
  chatMenuEl.className = "chat-menu";
  chatMenuEl.style.top = Math.min(r.bottom + 6, window.innerHeight - 170) + "px";
  chatMenuEl.style.left = Math.max(8, Math.min(r.left - 120, window.innerWidth - 190)) + "px";
  chatMenuEl.innerHTML =
    '<button data-act="rename" type="button">✏️ Rename</button>' +
    `<button data-act="pin" type="button">📌 ${c.pinned ? "Unpin" : "Pin"}</button>` +
    '<button data-act="delete" type="button" class="danger">🗑 Delete</button>';
  chatMenuEl.addEventListener("click", ev => {
    const act = ev.target.closest("[data-act]");
    if (!act) return;
    ev.stopPropagation();
    closeChatMenu();
    chatAction(id, act.dataset.act);
  });
  document.body.appendChild(chatMenuEl);
}

function chatAction(id, act) {
  const list = loadChats();
  const c = list.find(x => x.id === id);
  if (!c) return;
  if (act === "rename") { startRename(id); }
  else if (act === "pin") { c.pinned = !c.pinned; storeChats(list); renderChatList(); }
  else if (act === "delete") { if (confirm("Delete this conversation?")) deleteChat(id); }
}

// rename in place: Enter saves, Esc cancels
function startRename(id) {
  const item = document.querySelector(`.chat-item[data-chat="${CSS.escape(id)}"]`);
  const c = loadChats().find(x => x.id === id);
  if (!item || !c) return;
  const span = item.querySelector(".chat-title");
  const inp = document.createElement("input");
  inp.className = "chat-rename";
  inp.value = c.title;
  inp.maxLength = 60;
  span.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    const list = loadChats();
    const cc = list.find(x => x.id === id);
    if (cc && save && inp.value.trim()) { cc.title = inp.value.trim(); cc.custom = true; storeChats(list); }
    renderChatList();
  };
  inp.addEventListener("keydown", ev => {
    if (ev.key === "Enter") finish(true);
    if (ev.key === "Escape") finish(false);
  });
  inp.addEventListener("blur", () => finish(true));
  inp.addEventListener("click", ev => ev.stopPropagation());
}

// runs before the other click handlers, so ⋯ does not also open the chat
document.addEventListener("click", ev => {
  const more = ev.target.closest("[data-chat-more]");
  if (more) {
    ev.stopPropagation();
    ev.preventDefault();
    openChatMenu(more.dataset.chatMore, more);
    return;
  }
  if (chatMenuEl && !ev.target.closest(".chat-menu")) closeChatMenu();
}, true);

renderChatList();
// ---------- Decision Cockpit: Fact-Finder, readiness, assumptions, calibration ----------
(function addCockpitUI() {
  const tabs = document.querySelector("#insightsDrawer .tabs");
  if (tabs && !tabs.querySelector('[data-tab="cockpit"]')) {
    tabs.insertAdjacentHTML("beforeend", '<button class="tab" data-tab="cockpit" type="button">Cockpit</button>');
    tabs.lastElementChild.addEventListener("click", () => showTab("cockpit"));
  }
  const plansBox = $("tab-plans");
  if (plansBox && !$("tab-cockpit")) {
    plansBox.insertAdjacentHTML("afterend", '<div id="tab-cockpit" class="tabbody hidden"></div>');
  }
  const menu = $("labMenu");
  if (menu && !menu.querySelector('[data-lab="facts"]')) {
    menu.insertAdjacentHTML("afterbegin",
      '<button type="button" data-lab="facts">🧭 Find the facts<small>What you still need to verify, and how ready you are</small></button>');
    menu.querySelector('[data-lab="facts"]').addEventListener("click", () => runLab("facts"));
  }
})();

const showTabBeforeCockpit = showTab;
showTab = function (name) {
  showTabBeforeCockpit(name);
  const c = $("tab-cockpit");
  if (c) c.classList.toggle("hidden", name !== "cockpit");
};

let cockpitData = { topics: [], calibration: { n: 0, ready: false } };
const LEAN_CLASS = { "Go": "good", "Go with changes": "warn", "Wait": "bad" };

function calibrationHtml(c) {
  if (!c || !c.ready) {
    const more = Math.max(0, 5 - (c ? c.n : 0));
    return `<div class="card"><h5><span>📊 Your calibration</span></h5><p class="meta">Check ${more} more assumption${more === 1 ? "" : "s"} (say how sure you were, then mark it true or wrong) to unlock this.</p></div>`;
  }
  const gap = c.avg_confidence - c.hit_rate;
  const note = gap > 10 ? "You tend to be overconfident." : gap < -10 ? "You tend to be underconfident." : "Your confidence matches reality well.";
  return `<div class="card good"><h5><span>📊 Your calibration</span><span class="meta">${c.n} checked</span></h5><p>You were <b>${c.avg_confidence}%</b> sure on average, and <b>${c.hit_rate}%</b> turned out true. ${note}</p><p class="meta">Brier score ${c.brier} (0 is perfect)</p></div>`;
}

function itemHtml(it) {
  const isA = it.kind === "assumption";
  const conf = isA
    ? `<label class="ck-conf">I'm <select data-ck-conf="${it.id}"><option value="">–</option>${[50, 60, 70, 80, 90].map(v => `<option value="${v}" ${it.confidence === v ? "selected" : ""}>${v}%</option>`).join("")}</select> sure this is true</label>`
    : "";
  const yes = isA ? "✓ True" : "✓ Found it";
  const no = isA ? "✗ Wrong" : "✗ Not available";
  return `<div class="ck-item ${it.status}">
    <div class="ck-top"><span class="badge ${isA ? "warn" : "good"}">${isA ? "Assumption" : "Fact to find"}</span><span class="ck-text">${esc(it.statement)}</span></div>
    ${it.why ? `<div class="meta">${esc(it.why)}</div>` : ""}
    ${conf}
    <input class="ck-note" data-ck-note="${it.id}" placeholder="What did you find? (optional)" value="${esc(it.note || "")}">
    <div class="ck-actions">
      <button class="mini" type="button" data-ck-set="confirmed" data-ck-id="${it.id}">${yes}</button>
      <button class="mini" type="button" data-ck-set="refuted" data-ck-id="${it.id}">${no}</button>
      ${it.status !== "open" ? `<button class="mini" type="button" data-ck-set="open" data-ck-id="${it.id}">↺ Reopen</button>` : ""}
    </div>
  </div>`;
}

function topicHtml(t) {
  const r = t.readiness;
  const lean = t.lean ? `<span class="badge ${LEAN_CLASS[t.lean] || "warn"}">${esc(t.lean)}</span>` : "";
  return `<div class="plan ck-topic">
    <h5><span>🧭 ${esc(t.title)}</span>${lean}</h5>
    <div class="sub">${esc(short(t.decision_text, 120))}</div>
    <div class="progress-top"><b>${r.percent}% ready</b><span>${r.resolved} of ${r.total} verified</span></div>
    <div class="bar"><i style="width:${r.percent}%"></i></div>
    ${t.verdict_text ? `<div class="ck-verdict">${md(t.verdict_text)}</div>` : ""}
    ${t.items.map(itemHtml).join("")}
    <div class="ck-actions">
      <button class="mini" type="button" data-ck-verdict="${t.id}">🔄 Update verdict</button>
      <button class="mini" type="button" data-ck-del="${t.id}">🗑 Delete</button>
    </div>
  </div>`;
}

function renderCockpit() {
  const el = $("tab-cockpit");
  if (!el) return;
  const topics = cockpitData.topics || [];
  el.innerHTML =
    '<div class="empty"><b>Decision Cockpit:</b> NOVA lists what you still need to verify. Check items off to raise your readiness and sharpen the verdict. To start, type a decision in the chat box, then open <b>Lab → Find the facts</b>.</div>' +
    calibrationHtml(cockpitData.calibration) +
    (topics.length ? topics.map(topicHtml).join("") : '<div class="empty">No cockpits yet.</div>');
}

async function loadCockpit() {
  try { cockpitData = await api(`/cockpit/${USER_ID}`); } catch (e) { /* keep what we have */ }
  renderCockpit();
}

async function cockpitPatch(id, body) {
  try {
    await api(`/cockpit/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, ...body }),
    });
  } catch (e) { addMsg("sys", "⚠️ Couldn't save: " + esc(e.message || e)); }
  await loadCockpit();
}

async function cockpitVerdict(topicId, btn) {
  btn.disabled = true;
  btn.textContent = "Thinking…";
  try {
    await post("/cockpit/verdict", { user_id: USER_ID, topic_id: topicId });
  } catch (e) { addMsg("sys", "⚠️ " + esc(e.message || e)); }
  await loadCockpit();
}

document.addEventListener("click", async e => {
  const set = e.target.closest("[data-ck-set]");
  if (set) {
    const id = Number(set.dataset.ckId);
    const noteEl = document.querySelector(`[data-ck-note="${id}"]`);
    const confEl = document.querySelector(`[data-ck-conf="${id}"]`);
    const body = { status: set.dataset.ckSet, note: noteEl ? noteEl.value : "" };
    if (confEl && confEl.value) body.confidence = Number(confEl.value);
    await cockpitPatch(id, body);
    return;
  }
  const v = e.target.closest("[data-ck-verdict]");
  if (v) { await cockpitVerdict(Number(v.dataset.ckVerdict), v); return; }
  const d = e.target.closest("[data-ck-del]");
  if (d && confirm("Delete this cockpit?")) {
    try { await api(`/cockpit/topics/${d.dataset.ckDel}?user_id=${USER_ID}`, { method: "DELETE" }); } catch (err) { /* ignore */ }
    await loadCockpit();
    return;
  }
  if (e.target.closest("[data-open-cockpit]")) { showTab("cockpit"); openDrawer(insightsDrawer); }
});

// saving the confidence as soon as it is chosen
document.addEventListener("change", e => {
  const c = e.target.closest ? e.target.closest("[data-ck-conf]") : null;
  if (!c) return;
  const id = Number(c.dataset.ckConf);
  const noteEl = document.querySelector(`[data-ck-note="${id}"]`);
  cockpitPatch(id, { confidence: c.value ? Number(c.value) : null, note: noteEl ? noteEl.value : undefined });
});

// Lab -> Find the facts
const runLabBeforeCockpit = runLab;
runLab = async function (mode) {
  if (mode !== "facts") return runLabBeforeCockpit(mode);
  labMenu.classList.add("hidden");
  const text = input.value.trim();
  if (!text) {
    addMsg("sys", "Type the decision you are thinking about first, then pick Find the facts.");
    return;
  }
  if (sendBtn.disabled) return;

  addMsg("user", `🧭 Find the facts: ${esc(text)}`);
  input.value = "";
  autosize();
  sendBtn.disabled = true;
  labBtn.disabled = true;

  const typing = addMsg("bot typing", "Looking for what's missing…");
  try {
    const data = await post("/cockpit/analyze", { user_id: USER_ID, decision: text });
    typing.className = "msg bot";
    typing.innerHTML = md(data.reply) +
      '<div class="msg-sources"><button class="chip-btn" data-open-cockpit="1" type="button">🧭 Open the Cockpit</button></div>';
    history.push(
      { role: "user", content: `Find the facts for my decision: ${text}` },
      { role: "assistant", content: data.reply }
    );
    await loadCockpit();
    showTab("cockpit");
    openDrawer(insightsDrawer);
  } catch (e) {
    typing.className = "msg bot";
    typing.innerHTML = "<p>Sorry, Find the facts couldn't run.</p><p>" + esc(e.message || e) + "</p>";
  } finally {
    sendBtn.disabled = false;
    labBtn.disabled = false;
    chat.scrollTop = chat.scrollHeight;
    input.focus();
  }
};

let cockpitTries = 0;
function bootCockpit() {
  api(`/cockpit/${USER_ID}`)
    .then(d => { cockpitData = d; renderCockpit(); })
    .catch(() => { if (++cockpitTries < 12) setTimeout(bootCockpit, 5000); });
}
bootCockpit();
// ---------- agent trail: how NOVA worked, with a Guard that checks the citations ----------
let lastApiMs = null, lastApiPath = "";
const apiBeforeTrail = api;
api = async function (path, options) {
  const t0 = performance.now();
  try { return await apiBeforeTrail(path, options); }
  finally { lastApiMs = performance.now() - t0; lastApiPath = String(path); }
};

function guardCheck(data) {
  const text = String(data.answer || "");
  const memCited = new Set(), docCited = new Set();
  for (const m of text.matchAll(/Past decision #(\d+)/g)) memCited.add(Number(m[1]));
  for (const m of text.matchAll(/Doc:\s*([^,\]]+?),\s*parts?\s*([0-9][0-9,\s&]*(?:and\s*\d+)?)/gi)) {
    (m[2].match(/\d+/g) || []).forEach(n => docCited.add(m[1].trim() + "|" + n));
  }
  const memFound = new Set((data.memories_used || []).map(m => Number(m.source_id)));
  const docFound = new Set((data.documents_used || []).map(d => d.title + "|" + d.chunk_index));

  const ghosts = [];
  memCited.forEach(id => { if (!memFound.has(id)) ghosts.push("Past decision #" + id); });
  docCited.forEach(k => { if (!docFound.has(k)) ghosts.push(k.replace("|", ", part ")); });
  const matched = [...memCited].filter(id => memFound.has(id)).length + [...docCited].filter(k => docFound.has(k)).length;
  return { memCited: memCited.size, docCited: docCited.size, matched, ghosts };
}

function trailHtml(data) {
  const g = guardCheck(data);
  const mems = (data.memories_used || []).length, docs = (data.documents_used || []).length;
  const timing = (lastApiMs !== null && /advisor|lab|premortem/.test(lastApiPath)) ? (lastApiMs / 1000).toFixed(1) + " s" : "";

  let guardRow;
  if (g.ghosts.length) {
    guardRow = `<div class="trail-row warn"><span>🛡️</span><div><b>Guard agent</b><br>⚠️ ${g.ghosts.length} citation${g.ghosts.length === 1 ? "" : "s"} did not match anything NOVA found: ${esc(g.ghosts.join("; "))}. Treat ${g.ghosts.length === 1 ? "it" : "them"} with care.</div></div>`;
  } else if (g.matched) {
    guardRow = `<div class="trail-row good"><span>🛡️</span><div><b>Guard agent</b><br>✓ Checked ${g.matched} citation${g.matched === 1 ? "" : "s"}: all match your real memory and documents.</div></div>`;
  } else {
    guardRow = `<div class="trail-row"><span>🛡️</span><div><b>Guard agent</b><br>No sources were cited, so this answer comes from general knowledge.</div></div>`;
  }

  return `<details class="trail"><summary>🤖 How NOVA worked${timing ? " · " + timing : ""}</summary>
    <div class="trail-row"><span>🧠</span><div><b>Memory agent</b><br>Searched your decisions: found ${mems}, cited ${g.memCited}.</div></div>
    <div class="trail-row"><span>📄</span><div><b>Document agent</b><br>Searched your documents: found ${docs} passage${docs === 1 ? "" : "s"}, cited ${g.docCited}.</div></div>
    <div class="trail-row"><span>✍️</span><div><b>Advisor agent</b><br>Wrote the answer from your goals, limits and what was found.</div></div>
    ${guardRow}
  </details>`;
}

const renderEvidenceBeforeTrail = renderEvidence;
renderEvidence = function (data) {
  renderEvidenceBeforeTrail(data);
  const bots = document.querySelectorAll("#chat .msg.bot");
  const last = bots[bots.length - 1];
  if (!last || last.querySelector(".trail")) return;
  last.insertAdjacentHTML("beforeend", trailHtml(data));
}
// shorter placeholder on phones
function fitPlaceholder() {
  input.placeholder = window.innerWidth < 600
    ? "Ask NOVA…"
    : "Ask NOVA, or type a decision and open Lab…";
}
fitPlaceholder();
window.addEventListener("resize", fitPlaceholder);
// demo only: tell visitors what the sample profile is
const showUsageBeforeHint = showUsage;
showUsage = function (used, limit) {
  showUsageBeforeHint(used, limit);
  addDemoHint();
};

function addDemoHint() {
  const box = $("emptyState");
  if (!box || box.querySelector(".demo-hint")) return;
  box.insertAdjacentHTML("beforeend", `
    <div class="demo-hint">
      <b>You're exploring a sample profile.</b> NOVA knows a goal, salary limits and an offer letter for a sample user who is moving into a GenAI Engineer role. Your chats and Cockpits stay private to you. Within a chat NOVA remembers what you say, but it doesn't add it to the sample memory.
      <div class="demo-hint-actions">
        <button type="button" class="chip-btn" id="demoMemoryBtn">👀 See the sample data</button>
        <button type="button" class="chip-btn" id="demoAskBtn">📄 Ask about the offer letter</button>
      </div>
    </div>`);
  $("demoMemoryBtn").addEventListener("click", () => { showMenuTab("memory"); openDrawer(memoryDrawer); });
  $("demoAskBtn").addEventListener("click", () => {
    input.value = "Does my offer letter mention health insurance?";
    autosize();
    input.focus();
  });
}
// Guard v2: remembers sources found earlier in the same chat, and ignores capital letters in titles
const guardPool = { docs: new Set(), mems: new Set() };

guardCheck = function (data) {
  // the first question of a chat starts with an empty memory
  if (document.querySelectorAll("#chat .msg.user").length <= 1) {
    guardPool.docs.clear();
    guardPool.mems.clear();
  }

  const text = String(data.answer || "");
  const memCited = new Set(), docCited = new Set();
  for (const m of text.matchAll(/Past decision #(\d+)/g)) memCited.add(Number(m[1]));
  for (const m of text.matchAll(/Doc:\s*([^,\]]+?),\s*parts?\s*([0-9][0-9,\s&]*(?:and\s*\d+)?)/gi)) {
    (m[2].match(/\d+/g) || []).forEach(n => docCited.add(m[1].trim().toLowerCase() + "|" + n));
  }

  // add what was found for this question to what was found earlier in the chat
  (data.memories_used || []).forEach(m => guardPool.mems.add(Number(m.source_id)));
  (data.documents_used || []).forEach(d => guardPool.docs.add(String(d.title).toLowerCase() + "|" + d.chunk_index));

  const ghosts = [];
  memCited.forEach(id => { if (!guardPool.mems.has(id)) ghosts.push("Past decision #" + id); });
  docCited.forEach(k => { if (!guardPool.docs.has(k)) ghosts.push(k.replace("|", ", part ")); });
  const matched = [...memCited].filter(id => guardPool.mems.has(id)).length +
                  [...docCited].filter(k => guardPool.docs.has(k)).length;
  return { memCited: memCited.size, docCited: docCited.size, matched, ghosts };
};
// the free backend sleeps when idle: keep trying while it wakes up, show what is happening, reload once it is ready
(function () {
  if (["localhost", "127.0.0.1", ""].includes(location.hostname)) return;

  let note = document.querySelector(".wake-note");
  if (!note) {
    note = document.createElement("div");
    note.className = "wake-note hidden";
    const box = $("emptyState");
    if (box) box.appendChild(note);
  }
  const base = "The demo server is waking up. This can take a minute or two the first time, then it is fast. This page connects by itself.";
  const online = () => /online/i.test(statusEl.textContent || "");

  let tries = 0, lastProblem = "";
  async function check() {
    if (online()) {
      note.classList.add("hidden");
      try { sessionStorage.removeItem("nova_wake_reloads"); } catch (e) { /* storage blocked */ }
      return;
    }
    tries += 1;
    note.classList.remove("hidden");
    note.textContent = base + " (attempt " + tries + (lastProblem ? "; last problem: " + lastProblem : "") + ")";
    try {
      const r = await fetch(API_BASE + "/health", { cache: "no-store" });
      const d = await r.json();
      if (d && d.status === "ok") {
        let n = 0;
        try {
          n = Number(sessionStorage.getItem("nova_wake_reloads") || 0);
          sessionStorage.setItem("nova_wake_reloads", String(n + 1));
        } catch (e) { /* storage blocked */ }
        if (n < 3) { location.reload(); return; }
        lastProblem = "the server answers, but this page did not connect";
      } else {
        lastProblem = "unexpected answer from the server";
      }
    } catch (e) {
      lastProblem = (e && e.message) ? e.message : "no answer yet";
    }
    if (tries < 60) setTimeout(check, 4000);
  }
  setTimeout(check, 8000);
})();
// ---------- connection fix: always ask for fresh data, and show the real reason if the page cannot connect ----------
(function () {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    return realFetch(input, Object.assign({ cache: "no-store" }, init || {}));
  };
})();

pingServer = async function () {
  try {
    const res = await fetch(API_BASE + "/health", { headers: { "X-Visitor-Id": visitorId } });
    const d = await res.json();
    if (d && d.status === "ok") {
      statusEl.textContent = "Online";
      statusEl.classList.add("ok");
      window.novaPingError = "";
      try { await loadDashboard(); } catch (e) { window.novaPingError = "dashboard: " + ((e && e.message) ? e.message : e); }
      return;
    }
    window.novaPingError = "unexpected answer: " + JSON.stringify(d).slice(0, 80);
  } catch (e) {
    window.novaPingError = (e && e.message) ? e.message : String(e);
  }
  statusEl.textContent = "Waking up…";
  setTimeout(pingServer, 5000);
};

// show that real reason in the yellow note while the page is waiting
setInterval(function () {
  const n = document.querySelector(".wake-note");
  if (n && !n.classList.contains("hidden") && window.novaPingError) {
    n.textContent = n.textContent.replace(/ \(error:.*$/, "") + " (error: " + window.novaPingError + ")";
  }
}, 2000);