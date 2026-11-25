"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-client-session";

type Row = { id: string; name_en: string | null; name_hi: string | null; price_paise: number; duration_days: number | null; is_enabled: boolean };

export default function SubjectMonetizationAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [allEnabled, setAllEnabled] = useState(true);
  const [bulkPrice, setBulkPrice] = useState("29");
  const [bulkDays, setBulkDays] = useState("lifetime");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch("/api/admin/subject-access");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load settings.");
      setRows(data.subjects || []);
      setAllEnabled(data.all_subjects_enabled !== false);
    } catch (e: any) { setMessage(e.message || "Could not load settings."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(payload: any) {
    setBusy(true); setMessage("");
    try {
      const response = await adminFetch("/api/admin/subject-access", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed.");
      setMessage("Subject access settings saved successfully.");
      await load();
    } catch (e: any) { setMessage(e.message || "Save failed."); }
    finally { setBusy(false); }
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows(old => old.map(row => row.id === id ? { ...row, ...patch } : row));
  }

  async function saveAll() {
    await save({ all_subjects_enabled: allEnabled, subjects: rows.map(row => ({
      subject_id: row.id, price_paise: Math.round(Number(row.price_paise)), duration_days: row.duration_days,
      is_enabled: row.is_enabled
    })) });
  }

  async function bulkApply() {
    const price = Number(bulkPrice);
    const duration = bulkDays === "lifetime" ? null : Number(bulkDays);
    if (!Number.isFinite(price) || price < 0 || (duration !== null && (!Number.isInteger(duration) || duration < 1))) {
      setMessage("Please enter a valid price and duration."); return;
    }
    await save({ bulk: { price_paise: Math.round(price * 100), duration_days: duration, is_enabled: true } });
  }

  return <div className="admin-subject-mock">
    <div className="admin-page-heading">
      <div><span className="admin-kicker">REVENUE & ACCESS CONTROL</span><h1>Subject Monetization</h1>
      <p>All 7 student subjects, including Previous Year Questions (PYQ), are managed here. Set its price, validity and student access from this page.</p></div>
      <button className="admin-ghost" onClick={() => void load()} disabled={loading}>↻ Refresh</button>
    </div>

    <div className="admin-stat-grid">
      <div className="admin-stat-card"><small>Subjects</small><b>{rows.length}</b></div>
      <div className="admin-stat-card"><small>Default Price</small><b>₹29</b></div>
      <div className="admin-stat-card"><small>Global Status</small><b>{allEnabled ? "Unlocked" : "Locked"}</b></div>
    </div>
    {message && <p className="admin-inline-message">{message}</p>}

    <section className="admin-panel">
      <h2>Global Lock / Unlock</h2>
      <p className="admin-muted">Lock All blocks every subject, including students who already purchased access. Unlock All restores access subject to each subject's individual switch and purchase expiry.</p>
      <div className="admin-actions">
        <button disabled={busy} onClick={() => { setAllEnabled(true); void save({ all_subjects_enabled: true, unlock_all: true }); }}>Unlock All Subjects</button>
        <button className="danger" disabled={busy} onClick={() => { setAllEnabled(false); void save({ all_subjects_enabled: false }); }}>Lock All Subjects</button>
      </div>
    </section>

    <section className="admin-panel">
      <h2>Bulk Update</h2>
      <p className="admin-muted">Apply one price and duration to every active subject, including Previous Year Questions. Use Individual Subject Settings to price PYQ separately.</p>
      <div className="admin-form-grid">
        <label>Price per subject (₹)<input type="number" min="0" step="1" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} /></label>
        <label>Access duration<select value={bulkDays} onChange={e => setBulkDays(e.target.value)}>
          <option value="lifetime">Lifetime</option><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option>
        </select></label>
      </div>
      <button className="admin-primary" disabled={busy || loading} onClick={() => void bulkApply()}>{busy ? "Saving…" : "Apply to All Subjects"}</button>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-title"><div><h2>Individual Subject Settings</h2><p className="admin-muted">Each subject can have a different price, duration and lock state. Previous Year Questions (PYQ) has the same controls here.</p></div></div>
      {loading ? <p className="admin-muted">Loading subjects…</p> : rows.map(row => <article key={row.id} className="admin-subject-mock-row">
        <div className="admin-subject-mock-info"><h3>{row.name_en || row.name_hi || "Subject"}{String(row.name_en || "").toLowerCase().includes("previous year") && <span className="admin-pill active" style={{marginLeft:8}}>PYQ</span>}</h3>{row.name_hi && <small>{row.name_hi}</small>}
          <span className={"admin-pill " + (row.is_enabled && allEnabled ? "active" : "blocked")}>{row.is_enabled && allEnabled ? "Unlocked" : "Locked"}</span>
        </div>
        <div className="admin-subject-mock-meta">
          <label>Price (₹)<input type="number" min="0" value={(row.price_paise / 100).toString()} onChange={e => updateRow(row.id, { price_paise: Math.round(Number(e.target.value) * 100) })}/></label>
          <label>Duration<select value={row.duration_days === null ? "lifetime" : String(row.duration_days)} onChange={e => updateRow(row.id, { duration_days: e.target.value === "lifetime" ? null : Number(e.target.value) })}>
            <option value="lifetime">Lifetime</option><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option>
          </select></label>
          <label className="admin-switch"><span><b>Subject access</b><small>Allow students to purchase and use this subject.</small></span><input type="checkbox" checked={row.is_enabled} onChange={e => updateRow(row.id, { is_enabled: e.target.checked })}/></label>
        </div>
      </article>)}
      <button className="admin-primary" disabled={busy || loading} onClick={() => void saveAll()}>{busy ? "Saving…" : "Save All Subject Settings"}</button>
    </section>
  </div>;
}
