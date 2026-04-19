import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../../Utils/api";
import { getStoredAuthUser } from "../../Utils/auth_storage";
import { fetchSessionUser } from "../../Utils/session_auth";
import { clearStoredAuthUser } from "../../Utils/auth_storage";
import ArenaNavbar from "../../Components/ArenaNavbar";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import "../../Styles/contest_editorial.css";
import "../../Styles/contest_editorial_form.css";

// ── constants ─────────────────────────────────────────────────────────────────
const MAX_CHARS = 50000;

const PLACEHOLDER = `## Approach

Explain the key insight here...

## Solution

Describe the algorithm step by step.

\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    // your solution
}
\`\`\`

## Complexity

- **Time:** O(n log n)
- **Space:** O(n)
`;

// ── component ─────────────────────────────────────────────────────────────────
function ContestEditorialFormPage() {
  const { contestId, problemId } = useParams();
  const navigate = useNavigate();

  const [authUser,    setAuthUser]   = useState(() => getStoredAuthUser());
  const [problem,     setProblem]    = useState(null);
  const [content,     setContent]    = useState("");
  const [activeTab,   setActiveTab]  = useState("write");
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);
  const [toast,       setToast]      = useState(null); // { type: 'success'|'error', message }
  const [authError,   setAuthError]  = useState(false);
  const [existingId,  setExistingId] = useState(null); // non-null → editing an existing editorial

  const toastTimerRef = useRef(null);

  // ── guard — only setters / admins ─────────────────────────────────────────
  const isPrivileged = Boolean(
    authUser && ["problem_setter", "admin"].includes(authUser.role)
  );

  // ── sync session user ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      try {
        const user = await fetchSessionUser();
        if (mounted) setAuthUser(user);
      } catch {
        if (mounted) setAuthUser(getStoredAuthUser());
      }
    };
    sync();
    return () => { mounted = false; };
  }, []);

  // ── redirect unauthenticated / unprivileged ────────────────────────────────
  useEffect(() => {
    if (!loading && !isPrivileged) setAuthError(true);
  }, [loading, isPrivileged]);

  // ── load problem info + existing editorial ─────────────────────────────────
  useEffect(() => {
    if (!contestId || !problemId) return;
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // 1. Problem metadata
        const contestRes = await axios.get(
          `${API_BASE_URL}/contests/${contestId}/details/`,
          { withCredentials: true }
        );
        const problems = contestRes.data?.data?.problems || [];
        const found = problems.find((p) => String(p.problem_id) === String(problemId));
        if (mounted) setProblem(found || null);

        // 2. Existing editorial
        try {
          const editRes = await axios.get(
            `${API_BASE_URL}/contests/editorial/${problemId}/`,
            { withCredentials: true }
          );
          const existing = editRes.data?.editorial;
          if (existing && mounted) {
            setContent(existing.content || "");
            setExistingId(existing.editorial_id);
          }
        } catch (editErr) {
          // 404 → no editorial yet, that's fine
          if (editErr.response?.status !== 404) throw editErr;
        }
      } catch (err) {
        if (mounted) {
          showToast("error", err.response?.data?.error || "Failed to load page data.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [contestId, problemId]);

  // ── toast helper ──────────────────────────────────────────────────────────
  const showToast = (type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  };

  // ── save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!content.trim()) {
      showToast("error", "Editorial content cannot be empty.");
      return;
    }
    if (content.length > MAX_CHARS) {
      showToast("error", `Content exceeds the ${MAX_CHARS.toLocaleString()} character limit.`);
      return;
    }

    try {
      setSaving(true);
    if (existingId) {
       await axios.patch(
         `${API_BASE_URL}/contests/editorial/${problemId}/update/`,
         { content },
         { withCredentials: true }
       );
     } else {
       await axios.post(
         `${API_BASE_URL}/contests/editorial/create/`,
         { problem_id: problemId, content },
         { withCredentials: true }
       );
     }
      showToast("success", existingId ? "Editorial updated!" : "Editorial published!");
      // Brief pause so the user sees the success toast, then navigate to viewer
      setTimeout(() => {
        navigate(`/contest/${contestId}/problems/${problemId}/editorial`);
      }, 1200);
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to save editorial.");
    } finally {
      setSaving(false);
    }
  };


  // ── nav ────────────────────────────────────────────────────────────────────
  const navLinks = [
    { label: "Overview",    to: `/contest/${contestId}/`,               active: false },
    { label: "Leaderboard", to: `/contest/${contestId}/leaderboard`,    active: false },
  ];

  // ── guards ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <LoadingPage title="Loading editor" subtitle="Fetching problem and editorial data..." />
  );

  if (authError) return (
    <ErrorPage
      kicker="Access Denied"
      code="403"
      title="Not Authorised"
      copy="Only problem setters and admins can write or edit editorials."
      primaryAction={{ to: `/contest/${contestId}/problems/${problemId}/editorial`, label: "View Editorial" }}
      secondaryAction={{ to: `/contest/${contestId}/`, label: "Back to Contest" }}
    />
  );

  const charCount   = content.length;
  const nearLimit   = charCount > MAX_CHARS * 0.9;
  const overLimit   = charCount > MAX_CHARS;

  return (
    <div className="editorial-form-page">
      <ArenaNavbar navLinks={navLinks} authUser={authUser} />

      <main className="editorial-form-shell">

        {/* ── Back link ── */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            to={`/contest/${contestId}/problems/${problemId}/editorial`}
            className="editorial-form-back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to editorial
          </Link>
        </motion.div>

        {/* ── Page header ── */}
        <motion.div
          className="editorial-form-header"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <p className="editorial-form-kicker">
            {existingId ? "Edit Editorial" : "New Editorial"}
          </p>
          <h1 className="editorial-form-title">
            {existingId ? "Update" : "Write"} Editorial
          </h1>
          <p className="editorial-form-sub">
            Writing solution guide for{" "}
            <span className="editorial-form-problem-name">
              {problem?.title || "this problem"}
            </span>
            . Supports full Markdown — include code blocks, math explanations, and step-by-step walkthroughs.
          </p>
        </motion.div>

        {/* ── Toast ── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key="toast"
              className={`editorial-form-toast ${toast.type === "success" ? "is-success" : "is-error"}`}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span className="material-symbols-outlined">
                {toast.type === "success" ? "check_circle" : "error"}
              </span>
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Editor card ── */}
        <motion.div
          className="editorial-form-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          {/* Tab bar */}
          <div className="editorial-form-tabs" role="tablist">
            {[
              { key: "write",   icon: "edit",   label: "Write"   },
              { key: "preview", icon: "preview", label: "Preview" },
            ].map((tab) => (
              <motion.button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`editorial-form-tab ${activeTab === tab.key ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {tab.label}
              </motion.button>
            ))}
          </div>

          {/* Body */}
          <AnimatePresence mode="wait">
            {activeTab === "write" ? (
              <motion.div
                key="write-panel"
                className="editorial-form-body"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="editorial-form-field">
                  <label className="editorial-form-label" htmlFor="editorial-content">
                    Content — Markdown supported
                  </label>
                  <p className="editorial-form-hint">
                    Use <code>##</code> for section headings, triple backticks for code blocks, and <code>**bold**</code> for emphasis.
                  </p>
                  <textarea
                    id="editorial-content"
                    className="editorial-form-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={PLACEHOLDER}
                    spellCheck={false}
                    aria-describedby="char-count"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview-panel"
                className="editorial-form-body"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {content.trim() ? (
                  <article className="editorial-body editorial-form-preview">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                      {content}
                    </ReactMarkdown>
                  </article>
                ) : (
                  <div className="editorial-empty" style={{ minHeight: 260 }}>
                    <span className="material-symbols-outlined editorial-empty__icon">preview</span>
                    <p className="editorial-empty__title">Nothing to preview</p>
                    <p className="editorial-empty__sub">Switch to the Write tab and add some content.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Char counter */}
          <p
            id="char-count"
            className={`editorial-form-counter ${nearLimit ? "is-warning" : ""}`}
          >
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
            {overLimit && " — over limit"}
          </p>

          {/* Footer actions */}
          <div className="editorial-form-footer">
            <div className="editorial-form-footer__left">
              {existingId
                ? "Saving will overwrite the existing editorial."
                : "Publishing will make the editorial visible to all users."
              }
            </div>
            <div className="editorial-form-footer__right">
              <Link
                to={`/contest/${contestId}/problems/${problemId}/editorial`}
                className="editorial-btn-ghost"
              >
                Cancel
              </Link>
              <motion.button
                className="editorial-btn-primary"
                onClick={handleSave}
                disabled={saving || overLimit || !content.trim()}
                whileHover={!saving && !overLimit ? { scale: 1.04 } : {}}
                whileTap={!saving  ? { scale: 0.97 } : {}}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <span className="material-symbols-outlined">
                      {existingId ? "save" : "rocket_launch"}
                    </span>
                    {existingId ? "Update" : "Publish"}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

      </main>
    </div>
  );
}

export default ContestEditorialFormPage;