
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Student = {
  id: string;
  full_name: string | null;
  role: string;
  is_blocked: boolean;
  created_at: string;
};

export default function StudentsPage() {
  const sb = useMemo(() => supabaseBrowser(), []);

  const [rows, setRows] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    if (!sb) {
      setMsg("Supabase configuration missing.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const { data, error } = await sb
        .from("profiles")
        .select("id,full_name,role,is_blocked,created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setRows((data || []) as Student[]);
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Could not load students."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function block(student: Student) {
    if (!sb || student.role === "super_admin" || busy) return;

    const action = student.is_blocked ? "unblock" : "block";

    if (
      !window.confirm(
        `Are you sure you want to ${action} this student?`
      )
    ) {
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const { error } = await sb
        .from("profiles")
        .update({ is_blocked: !student.is_blocked })
        .eq("id", student.id);

      if (error) throw error;

      setMsg(`Student ${action}ed successfully.`);
      await load();
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Student status update failed."
      );
    } finally {
      setBusy(false);
    }
  }

  const filtered = rows.filter((student) =>
    `${student.full_name || ""} ${student.id} ${student.role}`
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  );

  const blockedCount = rows.filter(
    (student) => student.is_blocked
  ).length;

  const activeCount = rows.filter(
    (student) => !student.is_blocked
  ).length;

  return (
    <div className="admin-students-page">

      {/* Page Heading */}
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">
            STUDENT DIRECTORY · CONTROL CENTRE
          </span>

          <h1>Student Management</h1>

          <p>
            Manage registered students, monitor accounts
            and control student access.
          </p>
        </div>

        <button
          className="admin-primary compact"
          onClick={() => void load()}
          disabled={busy}
        >
          {busy ? "Refreshing..." : "↻ Refresh Students"}
        </button>
      </div>

      {/* Notification */}
      {msg && (
        <div className="admin-inline-message" role="status">
          {msg}
        </div>
      )}

      {/* Student Statistics */}
      <div className="admin-student-stats">

        <div className="admin-student-stat">
          <span>Total Students</span>
          <b>{rows.length}</b>
          <small>Registered accounts</small>
        </div>

        <div className="admin-student-stat">
          <span>Active Accounts</span>
          <b>{activeCount}</b>
          <small>Currently not blocked</small>
        </div>

        <div className="admin-student-stat">
          <span>Blocked Accounts</span>
          <b>{blockedCount}</b>
          <small>Restricted accounts</small>
        </div>

      </div>

      {/* Students Table */}
      <section className="admin-panel">

        <div className="admin-panel-title">
          <div>
            <span className="admin-kicker">
              ACCOUNT MANAGEMENT
            </span>

            <h2>Registered Students</h2>

            <small>
              {filtered.length} matching students
            </small>
          </div>

          <input
            className="admin-search"
            type="search"
            placeholder="Search student name, ID or role..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {busy && rows.length === 0 ? (
          <div className="admin-student-empty">
            Loading student records...
          </div>
        ) : (
          <div className="admin-table-wrap">

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th>Account Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>

                    <td>
                      <div className="admin-student-identity">
                        <span className="admin-student-avatar">
                          {(student.full_name || "S")
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <span>
                          <b>
                            {student.full_name || "Unnamed Student"}
                          </b>
                          <small>{student.id}</small>
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="admin-role-label">
                        {student.role}
                      </span>
                    </td>

                    <td>
                      {student.created_at
                        ? new Date(
                            student.created_at
                          ).toLocaleDateString("en-IN")
                        : "—"}
                    </td>

                    <td>
                      <span
                        className={
                          student.is_blocked
                            ? "admin-pill blocked"
                            : "admin-pill active"
                        }
                      >
                        {student.is_blocked
                          ? "Blocked"
                          : "Active"}
                      </span>
                    </td>

                    <td>
                      <button
                        className={
                          student.is_blocked
                            ? "admin-action"
                            : "admin-action danger"
                        }
                        disabled={
                          student.role === "super_admin" || busy
                        }
                        onClick={() => void block(student)}
                      >
                        {student.is_blocked
                          ? "Unblock"
                          : "Block"}
                      </button>
                    </td>

                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td colSpan={5}>
                      <div className="admin-student-empty">
                        {query
                          ? "No matching students found."
                          : "No registered students found."}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          </div>
        )}
      </section>

      <p className="admin-muted">
        Super Admin accounts cannot be blocked from this screen.
        Latest 500 student profiles are displayed.
      </p>

    </div>
  );
}
