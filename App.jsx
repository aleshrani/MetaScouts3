import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Plus, Check, Circle, StickyNote, X, Save, Filter, Briefcase,
  Trash2, GripVertical, Download, Link, AlertTriangle, Loader2,
  CheckCircle2, Copy, ArrowUpDown, Calendar, Paperclip,
  Image, ChevronDown, Eye, FileText, XCircle,
  Cloud, CloudOff, ExternalLink, RefreshCw, Flag, Shield,
  UserCheck, User
} from "lucide-react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPABASE CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SUPABASE_URL      = "https://rwucgqlrbyltxaxzided.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3dWNncWxyYnlsdHhheHppZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDY0ODgsImV4cCI6MjA4ODI4MjQ4OH0.o5xJAnoUfxeeBu5jAe-5AJ9AEq7UhWPBtXwhFJ1_yAQ";
const STORAGE_BUCKET    = "task-attachments";

const baseHeaders = {
  "apikey":        SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};
const jsonHeaders = {
  ...baseHeaders,
  "Content-Type": "application/json",
  "Prefer":       "return=representation",
};

async function safeJson(r) {
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

const db = {
  async select() {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?select=*&order=created_at.asc`,
      { method: "GET", headers: baseHeaders }
    );
    if (!r.ok) { const e = await safeJson(r); throw new Error(typeof e === "string" ? e : JSON.stringify(e)); }
    return r.json();
  },
  async insert(body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
      method: "POST", headers: jsonHeaders, body: JSON.stringify(body),
    });
    if (!r.ok) { const e = await safeJson(r); throw new Error(typeof e === "string" ? e : JSON.stringify(e)); }
    return r.json();
  },
  async update(id, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
      method: "PATCH", headers: jsonHeaders, body: JSON.stringify(body),
    });
    if (!r.ok) { const e = await safeJson(r); throw new Error(typeof e === "string" ? e : JSON.stringify(e)); }
    return r.json();
  },
  async remove(id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
      method: "DELETE", headers: baseHeaders,
    });
    if (!r.ok) { const e = await safeJson(r); throw new Error(typeof e === "string" ? e : JSON.stringify(e)); }
  },
  async uploadFile(taskId, file) {
    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `${taskId}/${Date.now()}.${ext}`;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method: "POST", headers: { ...baseHeaders, "Content-Type": file.type }, body: file,
    });
    if (!r.ok) { const e = await safeJson(r); throw new Error(typeof e === "string" ? e : JSON.stringify(e)); }
    return { name: file.name, url: `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}` };
  },
  async deleteFile(url) {
    const path = url.split(`/object/public/${STORAGE_BUCKET}/`)[1];
    if (!path) return;
    await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method: "DELETE", headers: baseHeaders,
    });
  },
  async ping() {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=id&limit=1`, {
        method: "GET", headers: baseHeaders,
      });
      return { ok: r.ok, status: r.status, text: await r.text() };
    } catch (e) { return { ok: false, status: 0, text: e.message }; }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLE — localStorage, stejná URL pro oba
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ROLE_KEY = "statusapp_role";
function getSavedRole() { try { return localStorage.getItem(ROLE_KEY) || "worker"; } catch { return "worker"; } }
function saveRole(r) { try { localStorage.setItem(ROLE_KEY, r); } catch {} }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STATUSES = [
  { id: "nezahajeno",   label: "Nezahájeno",  color: "bg-slate-100 text-slate-500 border-slate-200",       dot: "bg-slate-400",   ring: "ring-slate-200"  },
  { id: "probiha",      label: "Probíhá",      color: "bg-blue-50 text-blue-600 border-blue-200",           dot: "bg-blue-500",    ring: "ring-blue-200"   },
  { id: "ke-schvaleni", label: "Ke schválení", color: "bg-amber-50 text-amber-600 border-amber-200",        dot: "bg-amber-400",   ring: "ring-amber-200"  },
  { id: "hotovo",       label: "Hotovo",       color: "bg-emerald-50 text-emerald-600 border-emerald-200",  dot: "bg-emerald-500", ring: "ring-emerald-200" },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));

const PRIORITIES = [
  { id: "low",    label: "Nízká",   color: "text-slate-400", bg: "bg-slate-50 text-slate-500 border-slate-200", icon: "▽" },
  { id: "medium", label: "Střední", color: "text-amber-500", bg: "bg-amber-50 text-amber-600 border-amber-200", icon: "◈" },
  { id: "high",   label: "Vysoká",  color: "text-red-500",   bg: "bg-red-50 text-red-600 border-red-200",       icon: "▲" },
];
const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.id, p]));

const SORT_OPTIONS = [
  { id: "created",  label: "Datum přidání" },
  { id: "priority", label: "Priorita"      },
  { id: "deadline", label: "Deadline"      },
  { id: "status",   label: "Status"        },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function safeAtts(t) { return Array.isArray(t.attachments) ? t.attachments : []; }

function csvEscape(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportCSV(tasks) {
  const header = ["ID","Název","Priorita","Status","Deadline","Schváleno","Poznámka","Vytvořeno"];
  const rows = tasks.map(t => [
    t.id, t.title,
    (PRIORITY_MAP[t.priority] || PRIORITIES[1]).label,
    (STATUS_MAP[t.status]     || STATUSES[0]).label,
    t.deadline || "", t.approved ? "Ano" : "Ne", t.note || "",
    t.created_at ? new Date(t.created_at).toLocaleDateString("cs-CZ") : "",
  ].map(csvEscape).join(","));
  const blob = new Blob(["\uFEFF" + [header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `status-report-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

function deadlineLabel(dl) {
  if (!dl) return null;
  const diff = Math.ceil((new Date(dl) - Date.now()) / 864e5);
  if (diff < 0)  return { text: `po termínu ${Math.abs(diff)}d`, cls: "text-red-500 bg-red-50 border-red-200", urgent: true };
  if (diff === 0)return { text: "dnes",                           cls: "text-red-500 bg-red-50 border-red-200", urgent: true };
  if (diff <= 3) return { text: `za ${diff} d`,                  cls: "text-amber-600 bg-amber-50 border-amber-200", urgent: false };
  return { text: new Date(dl).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" }), cls: "text-slate-500 bg-slate-50 border-slate-200", urgent: false };
}

function isImageFile(name) { return /\.(png|jpe?g|gif|webp|svg)$/i.test(name || ""); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SMALL COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function StatusBadge({ statusId, onClick, disabled }) {
  const s = STATUS_MAP[statusId] || STATUSES[0];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 border rounded-full text-xs px-2.5 py-1 font-medium transition-all duration-150 select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300
        ${disabled ? "cursor-default" : "hover:opacity-80 active:scale-95"} ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </button>
  );
}
function StatusDropdown({ current, onChange, onClose }) {
  return (
    <div className="absolute z-50 mt-1 right-0 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
      {STATUSES.map(s => (
        <button key={s.id} onClick={() => { onChange(s.id); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300">
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}
          {s.id === current && <Check className="ml-auto w-3.5 h-3.5 text-slate-400" />}
        </button>
      ))}
    </div>
  );
}
function PriorityBadge({ priorityId, onClick, disabled }) {
  const p = PRIORITY_MAP[priorityId] || PRIORITIES[1];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1 border rounded-full text-xs px-2 py-0.5 font-semibold transition-all duration-150 select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300
        ${disabled ? "cursor-default" : "hover:opacity-80 active:scale-95"} ${p.bg}`}>
      <span className={p.color}>{p.icon}</span>{p.label}
    </button>
  );
}
function PriorityDropdown({ current, onChange, onClose }) {
  return (
    <div className="absolute z-50 mt-1 left-0 w-36 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
      {PRIORITIES.map(p => (
        <button key={p.id} onClick={() => { onChange(p.id); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300">
          <span className={`text-base ${p.color}`}>{p.icon}</span>{p.label}
          {p.id === current && <Check className="ml-auto w-3.5 h-3.5 text-slate-400" />}
        </button>
      ))}
    </div>
  );
}
function Toast({ message, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  const styles = { success: "bg-emerald-600", error: "bg-red-500", info: "bg-slate-700", boss: "bg-gradient-to-r from-violet-600 to-indigo-600" };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl ${styles[type] || styles.info}`}
      style={{ animation: "toast-in .25s cubic-bezier(.34,1.56,.64,1)" }}>
      {type === "success" && <CheckCircle2 className="w-4 h-4" />}
      {type === "error"   && <AlertTriangle className="w-4 h-4" />}
      {type === "boss"    && <Shield className="w-4 h-4" />}
      {message}
    </div>
  );
}
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const h = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} aria-label="Zavřít náhled obrázku" className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70"><X className="w-6 h-6" /></button>
      <img src={src} alt="" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLE SWITCHER — stejná URL, přepnutí přes localStorage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RoleSwitcher({ role, onSwitch }) {
  const isBoss = role === "boss";
  return (
    <button onClick={onSwitch}
      title={isBoss ? "Přepnout do pracovního módu" : "Přepnout do šéfského módu"}
      aria-label={isBoss ? "Přepnout do pracovního módu" : "Přepnout do šéfského módu"}
      className={`flex items-center gap-1.5 min-h-9 text-xs font-bold px-3 py-1.5 rounded-xl border shadow-sm transition-all duration-150 active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isBoss ? "focus-visible:ring-violet-300" : "focus-visible:ring-slate-300"}
        ${isBoss
          ? "bg-violet-100 border-violet-300 text-violet-700 hover:bg-violet-200"
          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50"}`}>
      {isBoss ? <><UserCheck className="w-3.5 h-3.5" />Šéf</> : <><User className="w-3.5 h-3.5" />Pracant</>}
    </button>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOSS APPROVE BUTTON — velké prominentní tlačítko
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function BossApproveButton({ approved, onChange, busy }) {
  return (
    <button onClick={() => onChange(!approved)} disabled={busy}
      className={`w-full flex items-center justify-center gap-2.5 min-h-11 py-3 px-4 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-95 disabled:opacity-50
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-300
        ${approved
          ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 border border-emerald-600"
          : "bg-white hover:bg-violet-50 text-violet-700 border-2 border-dashed border-violet-300 hover:border-violet-400"}`}>
      {busy
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : approved
          ? <><CheckCircle2 className="w-5 h-5" /><span>✅ Potvrzeno — úkol je HOTOVO</span></>
          : <><Shield className="w-5 h-5" /><span>Potvrdit jako hotové (schválení šéfa)</span></>}
    </button>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADD TASK PANEL — rozšiřitelný formulář
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AddTaskPanel({ onAdd, loading }) {
  const [title,    setTitle]    = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [note,     setNote]     = useState("");
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef();

  const canAdd = title.trim().length > 0;

  const handleAdd = async () => {
    if (!canAdd) return;
    await onAdd({ title: title.trim(), priority, deadline: deadline || null, note: note || "" });
    setTitle(""); setDeadline(""); setNote(""); setPriority("medium"); setExpanded(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`bg-white/95 border rounded-2xl shadow-md transition-all duration-200 ${expanded ? "border-blue-300 shadow-blue-100/70 ring-2 ring-blue-100" : "border-slate-200/90 hover:border-slate-300"}`}>
      <div className="flex gap-3 p-4">
        <div className="flex-1 min-w-0">
          <input ref={inputRef} type="text" value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && canAdd) handleAdd(); if (e.key === "Escape") { setTitle(""); setExpanded(false); } }}
            onFocus={() => setExpanded(true)}
            placeholder="Název nového úkolu…"
            className="w-full text-sm text-slate-800 placeholder-slate-300 bg-transparent focus:outline-none font-medium" />
          {expanded && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Flag className="w-3 h-3 text-slate-300" />
                {PRIORITIES.map(p => (
                  <button key={p.id} onClick={() => setPriority(p.id)}
                    className={`flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5 transition-all
                      ${priority === p.id ? `${p.bg} ring-2 ring-offset-1` : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                    <span className={priority === p.id ? p.color : ""}>{p.icon}</span>{p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-slate-300" />
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                  className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
          )}
          {expanded && (
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Volitelná poznámka…"
              className="w-full mt-3 text-xs text-slate-600 placeholder-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" />
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={handleAdd} disabled={!canAdd || loading}
            className="flex items-center gap-1.5 min-h-10 text-sm font-bold text-white bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 rounded-xl shadow-sm transition-all duration-150 active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Přidat
          </button>
          {expanded && (
            <button onClick={() => { setExpanded(false); setTitle(""); setNote(""); setDeadline(""); }}
              aria-label="Zavřít panel pro přidání úkolu"
              className="inline-flex items-center justify-center min-w-9 min-h-9 text-xs text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DB ERROR PANEL — diagnostika
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DbErrorPanel({ errorMsg, onRetry }) {
  const [diagResult,  setDiagResult]  = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const runDiag = async () => {
    setDiagLoading(true);
    const r = await db.ping();
    setDiagResult(r);
    setDiagLoading(false);
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-700">Nepodařilo se připojit k databázi</p>
          <p className="text-xs text-red-500 mt-0.5 break-all">{errorMsg}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={onRetry}
          className="flex items-center gap-1.5 min-h-9 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-xl transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-300">
          <RefreshCw className="w-3.5 h-3.5" />Zkusit znovu
        </button>
        <button onClick={runDiag} disabled={diagLoading}
          className="flex items-center gap-1.5 min-h-9 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
          {diagLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}Diagnostika
        </button>
      </div>
      {diagResult && (
        <div className={`rounded-xl px-4 py-3 text-xs font-mono space-y-1 ${diagResult.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-slate-900 text-emerald-400"}`}>
          <p><strong>HTTP status:</strong> {diagResult.status} {diagResult.ok ? "✅ OK" : "❌ CHYBA"}</p>
          <p className="break-all"><strong>Response:</strong> {diagResult.text?.slice(0, 300)}</p>
          {!diagResult.ok && (
            <div className="mt-2 pt-2 border-t border-slate-700 text-slate-300 space-y-1">
              <p className="font-bold text-slate-200">Možné příčiny:</p>
              <p>• Supabase projekt pozastaven (free tier → 1 týden neaktivity)</p>
              <p>• RLS blokuje anon přístup — přidej policy nebo vypni RLS</p>
              <p>• Tabulka "tasks" neexistuje nebo má jiný název</p>
              <p>• Špatný API klíč nebo URL</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK ROW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TaskRow({ task, onChange, onDelete, busy, notify, isBoss }) {
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [expanded,     setExpanded]     = useState(false);
  const [noteDraft,    setNoteDraft]    = useState(task.note || "");
  const [dlDraft,      setDlDraft]      = useState(task.deadline || "");
  const [saving,       setSaving]       = useState(false);
  const [approving,    setApproving]    = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [lightbox,     setLightbox]     = useState(null);
  const fileRef = useRef();

  useEffect(() => { setNoteDraft(task.note || ""); setDlDraft(task.deadline || ""); }, [task.note, task.deadline]);

  const saveDetails = async () => {
    setSaving(true);
    await onChange(task.id, { note: noteDraft, deadline: dlDraft || null });
    setSaving(false); notify("Uloženo ✓");
  };

  // ★ KLÍČOVÁ LOGIKA: schválení šéfem → status = "hotovo" automaticky
  const handleApprove = async (newApproved) => {
    setApproving(true);
    try {
      if (newApproved) {
        // Oba fieldy v jednom PATCH — atomicky
        await onChange(task.id, { approved: true, status: "hotovo" });
        notify("🏆 Schváleno! Úkol je HOTOVO", "boss");
      } else {
        await onChange(task.id, { approved: false, status: "ke-schvaleni" });
        notify("Schválení odebráno", "info");
      }
    } finally { setApproving(false); }
  };

  const handleFile = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { notify("Max 10 MB", "error"); return; }
    setUploading(true);
    try {
      const att  = await db.uploadFile(task.id, file);
      const atts = [...safeAtts(task), att];
      await onChange(task.id, { attachments: atts });
      notify("Příloha nahrána");
    } catch (err) { notify("Chyba nahrávání: " + err.message, "error"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const removeAtt = async idx => {
    const atts = [...safeAtts(task)]; const rem = atts.splice(idx, 1)[0];
    try { if (rem?.url) await db.deleteFile(rem.url); } catch {}
    await onChange(task.id, { attachments: atts });
  };

  const dl   = deadlineLabel(task.deadline);
  const atts = safeAtts(task);
  const isDone        = task.status === "hotovo";
  const isKeSchvaleni = task.status === "ke-schvaleni";

  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div className={`group bg-white/95 border rounded-2xl shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
        ${task.approved ? "border-emerald-300 bg-gradient-to-r from-emerald-50/30 to-white"
          : isBoss && isKeSchvaleni ? "border-violet-300 bg-violet-50/30 boss-pending"
          : "border-slate-200/90 hover:border-slate-300"}
        ${isDone && !task.approved ? "opacity-55" : ""}
        ${busy ? "opacity-50 pointer-events-none" : ""}`}>

        {/* TOP ROW */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
          <GripVertical className="hidden sm:block w-4 h-4 text-slate-200 group-hover:text-slate-300 flex-shrink-0 cursor-grab" onClick={e => e.stopPropagation()} />

          <div className="relative flex-shrink-0 order-1" onClick={e => e.stopPropagation()}>
            <PriorityBadge priorityId={task.priority} disabled={isBoss} onClick={isBoss ? undefined : () => setPriorityOpen(v => !v)} />
            {!isBoss && priorityOpen && (
              <><div className="fixed inset-0 z-40" onClick={() => setPriorityOpen(false)} />
                <PriorityDropdown current={task.priority} onChange={v => onChange(task.id, { priority: v })} onClose={() => setPriorityOpen(false)} /></>
            )}
          </div>

          <span className={`order-2 basis-full sm:basis-auto sm:flex-1 text-sm sm:text-base font-semibold leading-snug min-w-0 break-words ${isDone ? "line-through text-slate-500" : "text-slate-900"}`}>
            {task.title}
          </span>

          {dl && <span className={`hidden sm:flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5 flex-shrink-0 ${dl.cls} ${dl.urgent ? "animate-pulse" : ""}`}><Calendar className="w-3 h-3" />{dl.text}</span>}
          {task.approved && <span className="hidden sm:flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2.5 py-0.5 flex-shrink-0"><CheckCircle2 className="w-3 h-3" />Hotovo</span>}
          {isBoss && isKeSchvaleni && !task.approved && <span className="hidden sm:flex items-center gap-1 text-xs font-bold text-violet-700 bg-violet-100 border border-violet-300 rounded-full px-2.5 py-0.5 flex-shrink-0 animate-pulse"><Shield className="w-3 h-3" />Ke schválení</span>}
          {atts.length > 0 && <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400 flex-shrink-0"><Paperclip className="w-3 h-3" />{atts.length}</span>}

          <div className="relative flex-shrink-0 order-3" onClick={e => e.stopPropagation()}>
            <StatusBadge statusId={task.status} disabled={isBoss} onClick={isBoss ? undefined : () => setStatusOpen(v => !v)} />
            {!isBoss && statusOpen && (
              <><div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />
                <StatusDropdown current={task.status} onChange={v => onChange(task.id, { status: v })} onClose={() => setStatusOpen(false)} /></>
            )}
          </div>

          <ChevronDown className={`order-4 ml-auto sm:ml-0 w-4 h-4 text-slate-300 transition-transform flex-shrink-0 ${expanded ? "rotate-180 text-slate-500" : ""}`} />

          {!isBoss && (
            <button onClick={e => { e.stopPropagation(); onDelete(task.id); }} aria-label={`Smazat úkol ${task.title}`}
              className="order-5 inline-flex items-center justify-center min-w-9 min-h-9 p-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all duration-150 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-300">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* DETAIL */}
        {expanded && (
          <div className="border-t border-slate-200/80 bg-slate-50/35 px-5 py-4 space-y-4">

            {isBoss && (
              <div>
                <BossApproveButton approved={!!task.approved} onChange={handleApprove} busy={approving} />
                {task.approved && <p className="text-xs text-center text-emerald-600 mt-1.5 font-medium">Schváleno — status automaticky nastaven na Hotovo</p>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-2"><Calendar className="w-3 h-3" />Termín</label>
                {isBoss ? (
                  <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                  </p>
                ) : (
                  <input type="date" value={dlDraft} onChange={e => setDlDraft(e.target.value)}
                    className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition" />
                )}
              </div>

              {!isBoss && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-2"><Shield className="w-3 h-3" />Potvrzení šéfem</label>
                  <label className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${task.approved ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200 hover:border-slate-300"}`}>
                    <input type="checkbox" checked={!!task.approved} onChange={e => handleApprove(e.target.checked)} className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                    <span className={`text-sm font-medium ${task.approved ? "text-emerald-700" : "text-slate-500"}`}>
                      {task.approved ? "✅ Potvrzeno — status: Hotovo" : "Označit jako schváleno šéfem"}
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-2"><StickyNote className="w-3 h-3" />Poznámka</label>
              {isBoss ? (
                <p className={`text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[60px] ${task.note ? "text-slate-700" : "text-slate-300 italic"}`}>
                  {task.note || "Bez poznámky"}
                </p>
              ) : (
                <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={3}
                  placeholder="Komentář – blokátor, na koho se čeká, důvod zpoždění…"
                  className="w-full text-sm text-slate-700 placeholder-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition" />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-2"><Paperclip className="w-3 h-3" />Přílohy ({atts.length})</label>
              {atts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {atts.map((att, idx) => {
                    const img = isImageFile(att.name || "");
                    return (
                      <div key={idx} className="group/att relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 hover:border-slate-300 transition-all max-w-full sm:max-w-[200px]">
                        {img
                          ? <button onClick={() => setLightbox(att.url)} className="flex items-center gap-1.5 min-w-0"><Image className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /><span className="truncate">{att.name}</span><Eye className="w-3 h-3 text-slate-300 flex-shrink-0" /></button>
                          : <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 min-w-0"><FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /><span className="truncate">{att.name}</span><ExternalLink className="w-3 h-3 text-slate-300 flex-shrink-0" /></a>
                        }
                        {!isBoss && <button onClick={() => removeAtt(idx)} aria-label={`Odstranit přílohu ${att.name || idx + 1}`} className="opacity-0 group-hover/att:opacity-100 ml-1 inline-flex items-center justify-center min-w-8 min-h-8 text-red-400 hover:text-red-600 transition-all duration-150 flex-shrink-0 rounded-md focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-300"><XCircle className="w-3.5 h-3.5" /></button>}
                      </div>
                    );
                  })}
                </div>
              )}
              {!isBoss && (
                <>
                  <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" className="hidden" onChange={handleFile} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 min-h-10 text-xs font-medium text-slate-600 bg-white border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-xl px-4 py-2 transition-all duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                    {uploading ? "Nahrávám…" : "Přiložit soubor nebo obrázek"}
                  </button>
                </>
              )}
            </div>

            {!isBoss && (
              <div className="flex justify-end">
                <button onClick={saveDetails} disabled={saving}
                  className="flex items-center gap-1.5 min-h-10 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Uložit změny
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function App() {
  const [tasks,     setTasks]     = useState([]);
  const [role,      setRole]      = useState(getSavedRole);   // "worker" | "boss"
  const [filters,   setFilters]   = useState([]);
  const [sortBy,    setSortBy]    = useState("created");
  const [sortOpen,  setSortOpen]  = useState(false);
  const [toast,     setToast]     = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [synced,    setSynced]    = useState(false);
  const [rowBusy,   setRowBusy]   = useState(null);
  const [error,     setError]     = useState(null);

  const isBoss = role === "boss";

  const switchRole = () => {
    const next = isBoss ? "worker" : "boss";
    setRole(next); saveRole(next);
  };

  const notify = useCallback((msg, type = "success") => setToast({ message: msg, type, key: Date.now() }), []);

  const loadTasks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await db.select();
      setTasks(data.map(t => ({ ...t, attachments: safeAtts(t) })));
      setSynced(true);
    } catch (e) {
      setError(e.message || "Neznámá chyba");
      setSynced(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Auto-refresh: šéf 60s, pracant 120s
  useEffect(() => {
    const ms = isBoss ? 60_000 : 120_000;
    const id = setInterval(loadTasks, ms);
    return () => clearInterval(id);
  }, [isBoss, loadTasks]);

  const stats = useMemo(() =>
    Object.fromEntries(STATUSES.map(s => [s.id, tasks.filter(t => t.status === s.id).length])), [tasks]);

  const sorted = useMemo(() => {
    const PO = { high: 0, medium: 1, low: 2 };
    const SO = { "ke-schvaleni": 0, probiha: 1, nezahajeno: 2, hotovo: 3 };
    return [...tasks].sort((a, b) => {
      const aDone = a.status === "hotovo" ? 1 : 0, bDone = b.status === "hotovo" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (isBoss) {
        const aKS = a.status === "ke-schvaleni" ? 0 : 1, bKS = b.status === "ke-schvaleni" ? 0 : 1;
        if (aKS !== bKS) return aKS - bKS;
      }
      if (sortBy === "priority") return (PO[a.priority] ?? 1) - (PO[b.priority] ?? 1);
      if (sortBy === "deadline") { if (!a.deadline && !b.deadline) return 0; if (!a.deadline) return 1; if (!b.deadline) return -1; return new Date(a.deadline) - new Date(b.deadline); }
      if (sortBy === "status")   return (SO[a.status] ?? 9) - (SO[b.status] ?? 9);
      const byPri = (PO[a.priority] ?? 1) - (PO[b.priority] ?? 1);
      return byPri !== 0 ? byPri : new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });
  }, [tasks, sortBy, isBoss]);

  const filtered = useMemo(() => filters.length === 0 ? sorted : sorted.filter(t => filters.includes(t.status)), [sorted, filters]);

  const addTask = async ({ title, priority, deadline, note }) => {
    setLoading(true);
    try {
      const [created] = await db.insert({ title, status: "nezahajeno", priority, deadline: deadline || null, note: note || "", approved: false, attachments: [] });
      setTasks(p => [...p, { ...created, attachments: [] }]);
      notify("Úkol přidán");
    } catch (e) { notify("Chyba při přidávání: " + e.message, "error"); }
    finally { setLoading(false); }
  };

  const changeTask = async (id, fields) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, ...fields } : t));
    setRowBusy(id);
    try { await db.update(id, fields); }
    catch (e) { notify("Chyba při ukládání: " + e.message, "error"); await loadTasks(); }
    finally { setRowBusy(null); }
  };

  const deleteTask = async id => {
    if (!window.confirm("Smazat tento úkol?")) return;
    setTasks(p => p.filter(t => t.id !== id));
    try { await db.remove(id); notify("Úkol smazán", "info"); }
    catch (e) { notify("Chyba při mazání: " + e.message, "error"); await loadTasks(); }
  };

  const today         = new Date().toLocaleDateString("cs-CZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const approvedCount = tasks.filter(t => t.approved).length;
  const overdueCount  = tasks.filter(t => t.deadline && !t.approved && new Date(t.deadline) < Date.now()).length;
  const pendingBoss   = tasks.filter(t => t.status === "ke-schvaleni" && !t.approved).length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100/70" style={{ fontFamily: "'DM Sans','Helvetica Neue',Arial,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fade-up  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toast-in { from{opacity:0;transform:translateX(-50%) translateY(16px) scale(.96)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes boss-pulse { 0%,100%{border-color:rgb(167 139 250/.5)} 50%{border-color:rgb(139 92 246)} }
        .task-enter { animation: fade-up .2s ease-out }
        .boss-pending { animation: boss-pulse 2s ease-in-out infinite }
        * { box-sizing: border-box }
      `}</style>

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* SHARE MODAL */}
      {showShare && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><Link className="w-5 h-5 text-slate-700" /><h2 className="font-bold text-slate-900">Sdílet odkaz</h2></div>
              <button onClick={() => setShowShare(false)} aria-label="Zavřít dialog sdílení" className="inline-flex items-center justify-center min-w-9 min-h-9 p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              <p className="text-slate-600">
                Ty i šéf používáte <strong>stejnou URL</strong>. Mód (Pracant / Šéf) si každý přepne tlačítkem v pravém horním rohu. Data jsou sdílená v reálném čase přes Supabase.
              </p>
              <div className="flex gap-2">
                <input readOnly value={window.location.href} className="flex-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono truncate" />
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); notify("Odkaz zkopírován ✓"); setShowShare(false); }}
                  className="flex items-center gap-1.5 min-h-10 text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 px-4 py-2.5 rounded-xl transition-all duration-150 active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400">
                  <Copy className="w-4 h-4" />Kopírovat
                </button>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-violet-700 mb-1">💡 Jak na to</p>
                <p className="text-xs text-violet-600">
                  1. Pošli šéfovi tento odkaz<br />
                  2. Šéf klikne na tlačítko <strong>"Pracant"</strong> → přepne se na <strong>"Šéf"</strong><br />
                  3. V šéfském módu vidí úkoly ke schválení nahoře a může je jedním klikem potvrdit jako hotové
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">📱 Přidej na plochu mobilu</p>
                <p className="text-xs text-blue-600">iPhone: Safari → Sdílet → Přidat na plochu<br />Android: Chrome → ⋮ → Přidat na plochu</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className={`border-b sticky top-0 z-30 transition-all duration-300 backdrop-blur-md shadow-sm ${isBoss ? "bg-gradient-to-r from-violet-900/95 to-indigo-900/95 border-violet-700" : "bg-white/90 border-slate-200"}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0 sm:pr-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm ${isBoss ? "bg-white/20" : "bg-slate-900"}`}>
              {isBoss ? <Shield className="w-4 h-4 text-white" /> : <Briefcase className="w-4 h-4 text-white" />}
            </div>
            <div className="min-w-0">
              <h1 className={`text-lg font-bold leading-none transition-colors ${isBoss ? "text-white" : "text-slate-900"}`}>
                {isBoss ? "Šéfský mód" : "Status Report"}
              </h1>
              <p className={`text-sm mt-1 truncate transition-colors ${isBoss ? "text-violet-100/95" : "text-slate-600"}`}>
                {isBoss ? `${pendingBoss > 0 ? `${pendingBoss} ke schválení · ` : ""}${today}` : today}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            {STATUSES.map(s => (
              <div key={s.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold ${isBoss ? "bg-white/10 border-white/20 text-white" : s.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{stats[s.id]}
              </div>
            ))}
            {approvedCount > 0 && <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold ${isBoss ? "bg-white/10 border-white/20 text-emerald-300" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}><CheckCircle2 className="w-3 h-3" />{approvedCount}</div>}
            {overdueCount  > 0 && <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold ${isBoss ? "bg-red-500/20 border-red-400/30 text-red-300" : "bg-red-50 text-red-600 border-red-200"}`}><Calendar className="w-3 h-3" />{overdueCount}</div>}
          </div>

          <div className={`flex items-center flex-wrap sm:flex-nowrap justify-end gap-2 w-full sm:w-auto flex-shrink-0 pt-2 sm:pt-0 sm:pl-3 border-t sm:border-t-0 sm:border-l ${isBoss ? "border-white/20" : "border-slate-200/80"}`}>
            <div title={synced ? "Připojeno" : "Odpojeno"}
              className={`p-1.5 rounded-xl border transition-all ${synced ? isBoss ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-600" : isBoss ? "border-white/10 text-white/30" : "border-slate-200 bg-white text-slate-300"}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : synced ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            </div>
            {!isBoss && (
              <button onClick={() => exportCSV(tasks)}
                className="flex items-center justify-center gap-1.5 min-h-9 text-[11px] sm:text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300">
                <Download className="w-3.5 h-3.5" />CSV
              </button>
            )}
            <button onClick={() => setShowShare(true)}
              className={`flex items-center justify-center gap-1.5 min-h-9 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isBoss ? "bg-white text-violet-700 hover:bg-violet-50 focus-visible:ring-violet-300" : "text-white bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 focus-visible:ring-slate-400"}`}>
              <Link className="w-3.5 h-3.5" />Sdílet
            </button>
            <RoleSwitcher role={role} onSwitch={switchRole} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">

        {error && <DbErrorPanel errorMsg={error} onRetry={loadTasks} />}

        {isBoss && !error && pendingBoss > 0 && (
          <div className="flex items-center gap-3 bg-violet-50 border border-violet-300 rounded-2xl px-5 py-3.5">
            <Shield className="w-5 h-5 text-violet-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-violet-800">{pendingBoss} úkol{pendingBoss > 1 ? "ů" : ""} čeká na tvoje schválení</p>
              <p className="text-xs text-violet-600">Klikni na úkol → rozbal detail → stiskni tlačítko schválení</p>
            </div>
          </div>
        )}

        {isBoss && !error && pendingBoss === 0 && tasks.length > 0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-700">Vše vyřešeno! Žádné úkoly ke schválení. 🎉</p>
          </div>
        )}

        {synced && !isBoss && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-emerald-700">
              Připojeno · stejná URL pro tebe i šéfa · mód přepínáš tlačítkem <strong>Pracant / Šéf</strong> vpravo nahoře
            </p>
          </div>
        )}

        {!isBoss && <AddTaskPanel onAdd={addTask} loading={loading} />}

        {/* Filters + Sort */}
        <div className="flex items-center gap-2 flex-wrap bg-white/80 border border-slate-200 rounded-2xl px-3 sm:px-4 py-3 shadow-sm">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider"><Filter className="w-3 h-3" />Filtr</span>
          {STATUSES.map(s => (
            <button key={s.id} onClick={() => setFilters(p => p.includes(s.id) ? p.filter(f => f !== s.id) : [...p, s.id])}
              className={`flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-1 transition-all active:scale-95
                ${filters.includes(s.id) ? `${s.color} ring-2 ${s.ring}` : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${filters.includes(s.id) ? s.dot : "bg-slate-300"}`} />{s.label}
              {stats[s.id] > 0 && <span className={`font-bold ${filters.includes(s.id) ? "" : "text-slate-400"}`}>{stats[s.id]}</span>}
            </button>
          ))}
          {filters.length > 0 && <button onClick={() => setFilters([])} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"><X className="w-3 h-3" />Zrušit</button>}
          <div className="relative w-full sm:w-auto sm:ml-auto">
            <button onClick={() => setSortOpen(v => !v)} className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:border-slate-400 rounded-full px-3 py-1.5 shadow-sm">
              <ArrowUpDown className="w-3 h-3" />{SORT_OPTIONS.find(o => o.id === sortBy)?.label}
            </button>
            {sortOpen && (<><div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-44 overflow-hidden">
                {SORT_OPTIONS.map(o => (
                  <button key={o.id} onClick={() => { setSortBy(o.id); setSortOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 text-slate-700">
                    {o.label}{o.id === sortBy && <Check className="ml-auto w-3.5 h-3.5 text-slate-400" />}
                  </button>
                ))}
              </div></>)}
          </div>
        </div>

        {/* Task list */}
        <div className="space-y-2.5">
          {loading && tasks.length === 0 ? (
            <div className="text-center py-16 text-slate-300"><Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" /><p className="text-sm">Načítám z Supabase…</p></div>
          ) : !error && filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-300"><Circle className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm font-medium">Žádné úkoly k zobrazení</p></div>
          ) : filtered.map(task => (
            <div key={task.id} className="task-enter">
              <TaskRow task={task} onChange={changeTask} onDelete={deleteTask} busy={rowBusy === task.id} notify={notify} isBoss={isBoss} />
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 pt-3" style={{ fontFamily: "'DM Mono',monospace" }}>
          {tasks.length} úkolů · {stats["hotovo"]} hotovo · {approvedCount} schváleno
          {overdueCount > 0 && ` · ⚠ ${overdueCount} po termínu`} · ☁ Supabase{isBoss && " · 🔒 šéfský mód"}
        </p>
      </main>
    </div>
  );
}
