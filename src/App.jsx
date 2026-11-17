import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import Bloom from "./Bloom.jsx";

const TIER_NAMES = { minimum: "Minimum", average: "Average", high: "High" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "es"}`;
const EMPTY = { name: "", total: "", held: "0", attended: "0", perWeek: "", weeks: "" };

/* ---------- hero: the overall number ---------- */
function Overall({ o }) {
  const hasData = o && o.total > 0;
  let line = "Add a subject and the maths starts here.";
  if (hasData && o.held === 0) line = `Nothing counted yet. You can miss up to ${plural(o.skips_left, "class")} in total and still finish at ${o.target}%.`;
  else if (hasData && o.ok && o.skips_left === 0) line = `No spare classes. Missing one more drops you under ${o.target}%.`;
  else if (hasData && o.ok) line = `You can skip ${plural(o.skips_left, "more class")} and still finish at ${o.target}% or above.`;
  else if (hasData) {
    const left = o.total - o.held;
    line = o.catch_up <= left
      ? `Short by ${plural(o.short_by, "class")}. Attend the next ${o.catch_up} in a row to get back to ${o.target}%.`
      : `Finishing at ${o.target}% is out of reach with the classes left.`;
  }
  return (
    <div className="core panel">
      <p className="core-label">Overall attendance</p>
      <p className="core-num" aria-live="polite">
        {hasData && o.percent !== null ? o.percent.toFixed(1) : "–"}
        <span>%</span>
      </p>
      <p className="core-line">{line}</p>
      <p className="core-goal">Goal {o.target ?? 85}% across all subjects</p>
    </div>
  );
}

/* ---------- add / edit a subject ---------- */
function SubjectForm({ editing, onSave, onCancel }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    setF(editing ? { ...EMPTY, name: editing.name, total: String(editing.total), held: String(editing.held), attended: String(editing.attended) } : EMPTY);
  }, [editing]);

  const set = (k) => (e) => {
    const v = e.target.value;
    setF((p) => {
      const n = { ...p, [k]: v };
      if ((k === "perWeek" || k === "weeks") && n.perWeek && n.weeks) n.total = String(Number(n.perWeek) * Number(n.weeks));
      return n;
    });
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onSave({ name: f.name, total: Number(f.total), held: Number(f.held || 0), attended: Number(f.attended || 0) });
      if (!editing) setF(EMPTY);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} id="subject-form">
      <h2>{editing ? `Edit ${editing.name}` : "Add a subject"}</h2>
      <label>Subject
        <input value={f.name} onChange={set("name")} placeholder="Data structures" required maxLength={120} />
      </label>
      <div className="trio">
        <label>Total classes<input type="number" min="0" value={f.total} onChange={set("total")} required /></label>
        <label>Held so far<input type="number" min="0" value={f.held} onChange={set("held")} /></label>
        <label>You attended<input type="number" min="0" value={f.attended} onChange={set("attended")} /></label>
      </div>
      <div className="duo helper">
        <label>Classes per week<input type="number" min="0" value={f.perWeek} onChange={set("perWeek")} /></label>
        <label>Weeks in semester<input type="number" min="0" value={f.weeks} onChange={set("weeks")} /></label>
      </div>
      <p className="hint">Don’t know the total? Fill in both boxes above and it works it out.</p>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row">
        <button className="btn" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add subject"}</button>
        {editing && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

/* ---------- timetable photo ---------- */
function Upload({ onAdded }) {
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  const [err, setErr] = useState("");
  const [weeks, setWeeks] = useState(() => localStorage.getItem("leaving-weeks") || "16");
  const input = useRef(null);

  async function pick(file) {
    if (!file) return;
    setBusy(true);
    setErr("");
    setFound(null);
    try {
      const { subjects } = await api.parseTimetable(file);
      setFound(subjects.map((s) => ({ ...s, on: true })));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function addAll() {
    setBusy(true);
    setErr("");
    localStorage.setItem("leaving-weeks", weeks);
    try {
      for (const s of found.filter((x) => x.on)) {
        await api.add({ name: s.name, total: s.per_week * Number(weeks), held: 0, attended: 0 });
      }
      setFound(null);
      await onAdded();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  const chosen = found ? found.filter((x) => x.on).length : 0;

  return (
    <section className="panel">
      <h2>Read my timetable</h2>
      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
      >
        <input ref={input} type="file" accept="image/*" onChange={(e) => pick(e.target.files[0])} />
        <span>{busy && !found ? "Reading your timetable…" : "Drop a photo or screenshot here, or tap to choose one"}</span>
      </label>
      {err && <p className="error" role="alert">{err}</p>}
      {found && (
        <div className="found">
          <label>Weeks in semester
            <input type="number" min="1" max="52" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
          </label>
          <ul>
            {found.map((s, i) => (
              <li key={i}>
                <input type="checkbox" checked={s.on} aria-label={`Include ${s.name}`}
                  onChange={(e) => setFound(found.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                <span className="fname">{s.name}</span>
                <input type="number" min="1" max="30" value={s.per_week} aria-label={`${s.name} classes per week`}
                  onChange={(e) => setFound(found.map((x, j) => (j === i ? { ...x, per_week: Number(e.target.value) || 1 } : x)))} />
                <span className="hint">a week</span>
              </li>
            ))}
          </ul>
          <button className="btn" disabled={busy || !chosen || !weeks} onClick={addAll}>
            {busy ? "Adding…" : `Add ${chosen} subject${chosen === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- one subject ---------- */
function Subject({ s, onMark, onEdit, onDelete }) {
  const pct = s.percent ?? 0;
  return (
    <li className="subject">
      <div className="s-head">
        <div>
          <h3>{s.name}</h3>
          <p className="mono">{s.attended}/{s.held} attended · {s.remaining} of {s.total} classes left</p>
        </div>
        <p className="s-pct">{s.percent === null ? "–" : s.percent.toFixed(1)}<span>%</span></p>
      </div>

      <div className="bar" role="img" aria-label={`Attendance ${s.percent ?? 0} percent`}>
        <div className="fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        {[75, 85, 90].map((t) => (
          <i key={t} className="tick" style={{ left: `${t}%` }}><b>{t}</b></i>
        ))}
      </div>

      <div className="tiers">
        {Object.entries(s.tiers).map(([k, t]) => (
          <div key={k} className={`tier ${t.skips_left < 0 ? "short" : ""}`}>
            <p className="t-name">{TIER_NAMES[k]} {t.target}%</p>
            {t.skips_left >= 0 ? (
              <>
                <p className="t-num">{t.skips_left}</p>
                <p className="t-cap">{t.skips_left === 1 ? "class" : "classes"} you can skip</p>
              </>
            ) : (
              <>
                <p className="t-num">short by {t.short_by}</p>
                <p className="t-cap">
                  {t.catch_up <= s.remaining ? `attend the next ${t.catch_up} in a row` : "out of reach now"}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="row small">
        <button className="btn tiny" onClick={() => onMark(s.id, true)} disabled={s.remaining === 0}>Mark attended</button>
        <button className="btn tiny ghost" onClick={() => onMark(s.id, false)} disabled={s.remaining === 0}>Mark missed</button>
        <span className="grow" />
        <button className="link" onClick={() => onEdit(s)}>Edit</button>
        <button className="link" onClick={() => onDelete(s)}>Delete</button>
      </div>
    </li>
  );
}

/* ---------- page ---------- */
export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api.dashboard());
      setError("");
    } catch (x) {
      setError(`Couldn’t reach the server. Is the backend running? (${x.message})`);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = (fn) => async (...a) => {
    try { await fn(...a); await load(); } catch (x) { setError(x.message); }
  };

  const save = async (body) => {
    if (editing) await api.update(editing.id, body);
    else await api.add(body);
    setEditing(null);
    await load();
  };
  const mark = run((id, att) => api.mark(id, att));
  const del = run(async (s) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    await api.remove(s.id);
    if (editing?.id === s.id) setEditing(null);
  });
  const edit = (s) => {
    setEditing(s);
    document.getElementById("subject-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const subjects = data?.subjects ?? [];

  return (
    <>
      <Bloom />
      <div className="page">
        <header className="hero">
          <p className="words" aria-hidden="true"><span>don’t</span><span>have</span><span>to</span><span>be</span><span>ready</span></p>
          <h1 className="title t1">Leav<span className="sr">ing: </span></h1>
          {data && <Overall o={data.overall} />}
          <p className="title t2" aria-hidden="true">ing</p>
        </header>

        <main className="work">
          {error && <p className="error banner" role="alert">{error}</p>}
          <div className="col">
            <SubjectForm editing={editing} onSave={save} onCancel={() => setEditing(null)} />
            <Upload onAdded={load} />
          </div>
          <section className="panel list">
            <h2>Your subjects</h2>
            {subjects.length === 0 ? (
              <p className="empty">Nothing here yet. Add a subject on the left, or upload your timetable and let it find them for you.</p>
            ) : (
              <ul>{subjects.map((s) => <Subject key={s.id} s={s} onMark={mark} onEdit={edit} onDelete={del} />)}</ul>
            )}
          </section>
        </main>

        <footer className="words end" aria-hidden="true"><span>you</span><span>only</span><span>have</span><span>to</span><span>begin</span></footer>
      </div>
    </>
  );
}
