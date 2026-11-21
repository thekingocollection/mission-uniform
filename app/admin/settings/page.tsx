
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const defaults = {
  site_name: "MISSION UNIFORM OP",
  tagline: "आपकी वर्दी, आपका सपना।",
  maintenance_mode: false,
  registration_enabled: true,
  daily_test_enabled: true,
  weekly_test_enabled: true,
  ads_enabled: false,
  announcement: "",
};

type Settings = Record<string, any>;

type SettingRow = {
  key: string;
  value: any;
};

export default function SettingsPage() {
  const sb = useMemo(() => supabaseBrowser(), []);

  const [values, setValues] = useState<Settings>(defaults);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadSettings() {
      if (!sb) return;

      const { data, error } = await sb
        .from("site_settings")
        .select("key,value");

      if (error) {
        setMsg(error.message);
        return;
      }

      if (data?.length) {
        const merged: Settings = { ...defaults };

        (data as SettingRow[]).forEach((r) => {
          merged[r.key] = r.value;
        });

        setValues(merged);
      }
    }

    void loadSettings();
  }, [sb]);

  async function save() {
    if (!sb) {
      setMsg("Supabase connection is not available.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const entries = Object.entries(values);

      for (const [key, value] of entries) {
        const { error } = await sb
          .from("site_settings")
          .upsert(
            {
              key,
              value,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          );

        if (error) {
          setMsg(error.message);
          setBusy(false);
          return;
        }
      }

      setMsg("Website settings saved.");
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  const controls = [
    ["maintenance_mode", "Maintenance Mode", "Show maintenance state."],
    ["registration_enabled", "Student Registration", "Allow new student registration."],
    ["daily_test_enabled", "Daily Tests", "Enable daily mock tests."],
    ["weekly_test_enabled", "Weekly Grand Test", "Enable weekly test schedule."],
    ["ads_enabled", "Advertisements", "Global advertisement switch."],
  ];

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">PLATFORM CONFIGURATION</span>
          <h1>Website Settings</h1>
          <p>Control site identity, learning switches and announcements.</p>
        </div>

        <button
          className="admin-primary compact"
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {msg && <div className="admin-inline-message">{msg}</div>}

      <section className="admin-panel">
        <h2>Brand & Website</h2>

        <div className="admin-form-grid">
          <label>
            Website name
            <input
              value={values.site_name}
              onChange={(e) =>
                setValues({ ...values, site_name: e.target.value })
              }
            />
          </label>

          <label>
            Tagline
            <input
              value={values.tagline}
              onChange={(e) =>
                setValues({ ...values, tagline: e.target.value })
              }
            />
          </label>

          <label className="wide">
            Announcement
            <textarea
              rows={3}
              value={values.announcement}
              onChange={(e) =>
                setValues({ ...values, announcement: e.target.value })
              }
            />
          </label>
        </div>
      </section>

      <section className="admin-panel">
        <h2>Platform Controls</h2>

        <div className="admin-switch-list">
          {controls.map(([key, label, desc]) => (
            <label className="admin-switch" key={key}>
              <span>
                <b>{label}</b>
                <small>{desc}</small>
              </span>

              <input
                type="checkbox"
                checked={!!values[key]}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [key]: e.target.checked,
                  })
                }
              />
            </label>
          ))}
        </div>

        <button
          className="admin-primary"
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save All Settings"}
        </button>
      </section>

      <p className="admin-muted">
        These values are stored in Supabase site_settings.
        Frontend pages must read these settings for each switch
        to affect public behaviour.
      </p>
    </>
  );
}
