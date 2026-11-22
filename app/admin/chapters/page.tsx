import { filterExamSubjects } from "@/lib/exam-subjects";

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Subject = {
  id: string;
  name_en: string;
  name_hi: string | null;
  name_or: string | null;
};

type Chapter = {
  id: string;
  subject_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
  is_official: boolean;
  syllabus_source: string | null;
};

type Question = {
  subject_id: string;
  chapter: string | null;
};

export default function ChaptersPage() {
  const sb = useMemo(() => supabaseBrowser(), []);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [subjectId, setSubjectId] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    if (!sb) return;

    setLoading(true);
    setMessage("");

    const [subjectResult, chapterResult, questionResult] =
      await Promise.all([
        sb
          .from("subjects")
          .select("id,name_en,name_hi,name_or")
          .eq("is_active", true)
          .order("name_en"),

        sb
          .from("chapters")
          .select(
            "id,subject_id,name,sort_order,is_active,is_official,syllabus_source"
          )
          .order("sort_order"),

        sb
          .from("questions")
          .select("subject_id,chapter")
      ]);

    const error =
      subjectResult.error ||
      chapterResult.error ||
      questionResult.error;

    if (error) {
      setMessage(error.message);
    } else {
      setSubjects(filterExamSubjects(subjectResult.data || []));
      setChapters(chapterResult.data || []);
      setQuestions(questionResult.data || []);

      if (!subjectId && subjectResult.data?.length) {
        setSubjectId(subjectResult.data[0].id);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredChapters = chapters.filter((chapter) => {
    const matchesSubject =
      !subjectId || chapter.subject_id === subjectId;

    const matchesSearch = chapter.name
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesSubject && matchesSearch;
  });

  function getQuestionCount(chapter: Chapter) {
    return questions.filter(
      (question) =>
        question.subject_id === chapter.subject_id &&
        question.chapter?.trim().toLowerCase() ===
          chapter.name.trim().toLowerCase()
    ).length;
  }

  async function saveChapter() {
    if (!sb) return;

    if (!subjectId || !chapterName.trim()) {
      setMessage("Please select a subject and enter chapter name.");
      return;
    }

    setLoading(true);
    setMessage("");

    const cleanName = chapterName.trim();

    if (editingId) {
      const oldChapter = chapters.find(
        (chapter) => chapter.id === editingId
      );

      if (!oldChapter) {
        setMessage("Chapter not found.");
        setLoading(false);
        return;
      }

      const { error } = await sb
        .from("chapters")
        .update({
          subject_id: subjectId,
          name: cleanName
        })
        .eq("id", editingId);

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (
        oldChapter.name !== cleanName ||
        oldChapter.subject_id !== subjectId
      ) {
        const { error: questionError } = await sb
          .from("questions")
          .update({ chapter: cleanName, subject_id: subjectId })
          .eq("subject_id", oldChapter.subject_id)
          .eq("chapter", oldChapter.name);

        if (questionError) {
          setMessage(
            "Chapter updated, but existing question mapping failed: " +
              questionError.message
          );
        } else {
          setMessage("Chapter and linked questions updated.");
        }
      } else {
        setMessage("Chapter updated successfully.");
      }
    } else {
      const { error } = await sb.from("chapters").insert({
        subject_id: subjectId,
        name: cleanName,
        is_active: true,
        is_official: false
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setMessage("New chapter added successfully.");
    }

    setChapterName("");
    setEditingId(null);
    await loadData();
  }

  function startEdit(chapter: Chapter) {
    setEditingId(chapter.id);
    setSubjectId(chapter.subject_id || "");
    setChapterName(chapter.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleChapter(chapter: Chapter) {
    if (!sb) return;

    const action = chapter.is_active ? "hide" : "activate";

    if (!confirm(`Are you sure you want to ${action} this chapter?`)) {
      return;
    }

    const { error } = await sb
      .from("chapters")
      .update({ is_active: !chapter.is_active })
      .eq("id", chapter.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`Chapter ${action}d successfully.`);
      await loadData();
    }
  }

  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">SYLLABUS MASTER</span>
          <h1>Subject & Chapter Management</h1>
          <p>
            Manage your Odisha Police syllabus and chapter-wise
            Question Bank.
          </p>
        </div>

        <button
          className="admin-primary compact"
          onClick={() => void loadData()}
        >
          Refresh
        </button>
      </div>

      {message && (
        <div className="admin-inline-message">{message}</div>
      )}

      <section className="admin-panel">
        <h2>{editingId ? "Edit Chapter" : "Add New Chapter"}</h2>

        <div className="form-grid">
          <label>
            Select Subject
            <select
              className="admin-search"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Select Subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name_en}
                </option>
              ))}
            </select>
          </label>

          <label>
            Chapter Name
            <input
              className="admin-search"
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              placeholder="Example: Percentage"
            />
          </label>
        </div>

        <div className="result-actions">
          <button
            className="admin-primary compact"
            disabled={loading}
            onClick={() => void saveChapter()}
          >
            {loading
              ? "Saving..."
              : editingId
                ? "Update Chapter"
                : "Add Chapter"}
          </button>

          {editingId && (
            <button
              className="admin-action"
              onClick={() => {
                setEditingId(null);
                setChapterName("");
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-title">
          <div>
            <h2>Chapter Master</h2>
            <small>
              {filteredChapters.length} chapters available
            </small>
          </div>

          <div className="result-actions">
            <select
              className="admin-search"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name_en}
                </option>
              ))}
            </select>

            <input
              className="admin-search"
              placeholder="Search chapter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="admin-muted">Loading chapters...</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Chapter</th>
                  <th>Questions</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredChapters.map((chapter) => (
                  <tr key={chapter.id}>
                    <td>
                      {subjects.find(
                        (s) => s.id === chapter.subject_id
                      )?.name_en || "—"}
                    </td>

                    <td><b>{chapter.name}</b></td>

                    <td>{getQuestionCount(chapter)}</td>

                    <td>
                      {chapter.is_official
                        ? "Official syllabus"
                        : "Admin added"}
                    </td>

                    <td>
                      <span
                        className={
                          chapter.is_active
                            ? "admin-pill active"
                            : "admin-pill blocked"
                        }
                      >
                        {chapter.is_active ? "Active" : "Hidden"}
                      </span>
                    </td>

                    <td>
                      <div className="result-actions">
                        <button
                          className="admin-action"
                          onClick={() => startEdit(chapter)}
                        >
                          Edit
                        </button>

                        <button
                          className="admin-action"
                          onClick={() =>
                            void toggleChapter(chapter)
                          }
                        >
                          {chapter.is_active ? "Hide" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredChapters.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      No chapters found. Add a chapter above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="admin-muted">
        Hiding a chapter does not delete its questions.
        Only verified questions should be used in published tests.
      </p>
    </div>
  );
}
