import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { motion, AnimatePresence } from "motion/react";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import "../../Styles/problem_solving.css";
import { getStoredAuthUser } from "../../Utils/auth_storage";
import { API_BASE_URL } from "../../Utils/api";
import { formatDisplayText } from "../../Utils/format_display_text";
import ThemeToggle from "../../Components/ThemeToggle";
import { useTheme } from "../../Theme/ThemeProvider";

const LANGUAGE_PRESETS = {
  "C++20": {
    monacoLanguage: "cpp",
    starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`,
  },
  "Python 3.11": {
    monacoLanguage: "python",
    starterCode: `def solve():
    pass


if __name__ == "__main__":
    solve()
`,
  },
  "Java 17": {
    monacoLanguage: "java",
    starterCode: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
    }
}
`,
  },
};

const FALLBACK_CONSOLE_LINES = [
  "Judge connection is not wired yet.",
  "Use Run for the mock console view.",
  "Use Submit to create a submission entry only.",
];

const getLanguagePreset = (languageName) =>
  LANGUAGE_PRESETS[languageName] || { monacoLanguage: "plaintext", starterCode: "" };

const normalizeDifficulty = (difficulty) => {
  const value = String(difficulty || "").toLowerCase().trim();
  if (value === "easy") return "is-easy";
  if (value === "medium") return "is-medium";
  if (value === "hard") return "is-hard";
  return "";
};

const getSubmissionTone = (submission) => {
  const status = String(submission?.status || "").toLowerCase();
  if (status === "completed") return "is-complete";
  if (status === "error" || status === "failed") return "is-error";
  return "is-pending";
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

// ── animation variants ───────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0  },
};

const submissionStagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

// ── component ────────────────────────────────────────────────
function ProblemSolvingPage() {
  const { contestId, problemId } = useParams();
  const [solveData, setSolveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [activePanel, setActivePanel] = useState("submissions");
  const [consoleLines, setConsoleLines] = useState(FALLBACK_CONSOLE_LINES);
  const [bannerMessage, setBannerMessage] = useState("");
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const { isDarkMode } = useTheme();

  const problem = solveData?.problem || null;
  const contest = solveData?.contest || null;
  const visibleTestcases = useMemo(() => Array.isArray(solveData?.testcases) ? solveData.testcases : [], [solveData]);
  const authUser = getStoredAuthUser();
  const canManageProblems = Boolean(authUser && ["problem_setter", "admin"].includes(authUser?.role));

  const selectedLanguage = useMemo(
    () => languages.find((l) => String(l.language_id) === String(selectedLanguageId)) || null,
    [languages, selectedLanguageId]
  );

  const selectedPreset = useMemo(
    () => getLanguagePreset(selectedLanguage?.name || ""),
    [selectedLanguage]
  );

  useEffect(() => {
    const fetchSolveData = async () => {
      try {
        setLoading(true); setError(""); setErrorStatus(null);
        const [solveResponse, langResponse, subResponse] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/contests/${contestId}/problems/${problemId}/solve`, { withCredentials: true }),
          axios.get(`${API_BASE_URL}/contests/languages/`, { withCredentials: true }),
          axios.get(`${API_BASE_URL}/contests/${contestId}/problems/${problemId}/submissions/`, { withCredentials: true }),
        ]);
        if (solveResponse.status === "fulfilled") setSolveData(solveResponse.value.data?.data || null);
        else { setError(solveResponse.reason?.response?.data?.error || solveResponse.reason?.message || "Unable to load problem."); setErrorStatus(solveResponse.reason?.response?.status ?? null); }
        if (langResponse.status === "fulfilled") {
          const langs = Array.isArray(langResponse.value.data) ? langResponse.value.data : [];
          setLanguages(langs);
          if (langs.length > 0) {
            setSelectedLanguageId(String(langs[0].language_id));
            setSourceCode(getLanguagePreset(langs[0].name).starterCode);
          }
        }
        if (subResponse.status === "fulfilled") setSubmissions(Array.isArray(subResponse.value.data) ? subResponse.value.data : []);
      } catch (err) {
        setError(err.message || "An unexpected error occurred.");
      } finally { setLoading(false); }
    };
    if (contestId && problemId) fetchSolveData();
  }, [contestId, problemId]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    monacoRef.current.editor.setModelLanguage(model, selectedPreset.monacoLanguage);
  }, [selectedPreset.monacoLanguage]);

  const handleLanguageChange = (event) => {
    const nextLanguageId = event.target.value;
    const nextLanguage = languages.find((l) => String(l.language_id) === String(nextLanguageId));
    setSelectedLanguageId(nextLanguageId);
    setBannerMessage("");
    if (nextLanguage) setSourceCode(getLanguagePreset(nextLanguage.name).starterCode);
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    const model = editor.getModel();
    if (model) monaco.editor.setModelLanguage(model, selectedPreset.monacoLanguage);
  };

  const handleRun = () => {
    setActivePanel("console");
    setBannerMessage("Mock run opened. Execution is not connected yet.");
    setConsoleLines((current) => [
      `[${new Date().toLocaleTimeString("en-IN")}] Mock run started for ${selectedLanguage?.name || "the selected language"}.`,
      "No compile or execution step has been wired yet.",
      ...current,
    ]);
  };

  const handleSubmit = async () => {
    if (!selectedLanguage || !sourceCode.trim()) {
      setBannerMessage("Choose a language and enter some code before submitting.");
      return;
    }
    try {
      setSubmitting(true); setBannerMessage(""); setActivePanel("submissions");
      const response = await axios.post(
        `${API_BASE_URL}/contests/${contestId}/problems/${problemId}/submit`,
        { language_id: Number(selectedLanguage.language_id), language_name: selectedLanguage.name, source_code: sourceCode },
        { withCredentials: true }
      );
      const newSubmission = response.data?.data;
      if (newSubmission) setSubmissions((current) => [newSubmission, ...current]);
      setConsoleLines((current) => [
        `[${new Date().toLocaleTimeString("en-IN")}] Submission queued for ${selectedLanguage.name}.`,
        "Judge execution is still mocked, so the row is added without running tests.",
        ...current,
      ]);
      setBannerMessage("Submission added to the list.");
    } catch (err) {
      setBannerMessage(err.response?.data?.error || err.message || "Unable to add the submission right now.");
    } finally { setSubmitting(false); }
  };

  if (loading) return <LoadingPage title="Loading problem workspace" subtitle="Preparing the statement, visible samples, editor session, and recent submissions." />;

  if (error || !problem) {
    const isRunningContest = errorStatus === 403 || /contest is running/i.test(error);
    return <ErrorPage kicker={isRunningContest ? "Contest Locked" : "Workspace Error"} code={isRunningContest ? "403" : "500"} title={isRunningContest ? "Contest is running" : "The problem workspace could not be opened."} copy={error || "Problem details are unavailable for this contest."} primaryAction={{ label: "Back To Contest", to: `/contest/${contestId}/` }} secondaryAction={{ label: "View Contests", to: "/contests" }} />;
  }

  return (
    <div className="solve-page-shell">

      {/* ── Topbar slides down ── */}
      <motion.header
        className="solve-topbar"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="solve-topbar__brand">
          <Link to="/contests" className="solve-wordmark">AlgoArena</Link>
          <div className="solve-breadcrumbs">
            <Link to="/contests">Contests</Link>
            <span>/</span>
            <Link to={`/contest/${contestId}/`}>{contest?.title || "Contest"}</Link>
            <span>/</span>
            <span>{problem.title}</span>
          </div>
        </div>

        <div className="solve-topbar__actions">
          <ThemeToggle />
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 380, damping: 18 }}>
            <Link to={`/contest/${contestId}/`} className="solve-header-link">Contest</Link>
          </motion.div>
          {canManageProblems ? (
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 380, damping: 18 }}>
              <Link to={`/contest/${contestId}/problems/edit`} className="solve-header-link">Manage</Link>
            </motion.div>
          ) : null}
        </div>
      </motion.header>

      <main className="solve-layout">

        {/* ── Sidebar slides in from left ── */}
        <motion.aside
          className="solve-sidebar"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <div className="solve-sidebar__contest">
            <span className="solve-sidebar__eyebrow">Live Workspace</span>
            <h2>{contest?.title || "Contest Problem"}</h2>
            <p>Read the statement, code beside it, and track submissions in one place.</p>
          </div>

          <div className="solve-sidebar__meta">
            <div><span>Difficulty</span><strong className={normalizeDifficulty(problem.difficulty)}>{problem.difficulty}</strong></div>
            <div><span>Time Limit</span><strong>{problem.time_limit_ms} ms</strong></div>
            <div><span>Memory Limit</span><strong>{problem.memory_limit_kb} KB</strong></div>
            <div><span>Score</span><strong>{problem.max_score ?? "N/A"}</strong></div>
          </div>

          <div className="solve-sidebar__tags">
            {(problem.tags || []).length > 0
              ? problem.tags.map((tag) => <span className="solve-tag" key={tag}>{tag}</span>)
              : <span className="solve-tag is-muted">No tags</span>
            }
          </div>

          <div className="solve-sidebar__notes">
            <p>Visible tests: {visibleTestcases.length}</p>
            <p>Hidden tests: {solveData?.hidden_testcase_count || 0}</p>
            <p>Submissions loaded: {submissions.length}</p>
          </div>
        </motion.aside>

        {/* ── Workspace fades in ── */}
        <motion.section
          className="solve-workspace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.18 }}
        >
          <div className="solve-panels">
            <article className="solve-problem-panel">
              <div className="solve-panel-header">
                <div>
                  <span className="solve-panel-kicker">Problem</span>
                  <h1>{problem.title}</h1>
                </div>
                <div className={`solve-difficulty-pill ${normalizeDifficulty(problem.difficulty)}`}>{problem.difficulty}</div>
              </div>

              <div className="solve-panel-stats">
                <div><span className="material-symbols-outlined">timer</span><span>{problem.time_limit_ms} ms</span></div>
                <div><span className="material-symbols-outlined">memory</span><span>{problem.memory_limit_kb} KB</span></div>
                <div><span className="material-symbols-outlined">visibility</span><span>{problem.visibility}</span></div>
              </div>

              <div className="solve-markdown">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {problem.description || "This problem does not have a published description yet."}
                </ReactMarkdown>
              </div>

              <div className="solve-samples">
                <div className="solve-samples__header">
                  <div><span className="solve-panel-kicker">Visible Testcases</span></div>
                  <span className="solve-sample-note">{solveData?.hidden_testcase_count || 0} hidden testcase(s) stay private</span>
                </div>
                {visibleTestcases.length === 0 ? (
                  <div className="solve-empty-state">No visible testcases were published for this problem yet.</div>
                ) : (
                  <div className="solve-sample-grid">
                    {visibleTestcases.map((testcase, index) => (
                      <motion.section
                        className="solve-sample-card"
                        key={testcase.testcase_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + index * 0.08, duration: 0.35 }}
                      >
                        <h3>Example {index + 1}</h3>
                        <div className="solve-sample-io">
                          <div><label>Input</label><pre>{testcase.input_data || "(empty)"}</pre></div>
                          <div><label>Output</label><pre>{testcase.output_data || "(empty)"}</pre></div>
                        </div>
                      </motion.section>
                    ))}
                  </div>
                )}
              </div>
            </article>

            <section className="solve-editor-panel">
              <div className="solve-editor-toolbar">
                <div className="solve-editor-toolbar__left">
                  <label className="solve-language-picker">
                    <span>Language</span>
                    <select value={selectedLanguageId} onChange={handleLanguageChange}>
                      {languages.map((language) => (
                        <option key={language.language_id} value={language.language_id}>{language.name}</option>
                      ))}
                    </select>
                  </label>
                  <span className="solve-editor-hint">Monaco editor enabled</span>
                </div>

                <div className="solve-editor-toolbar__actions">
                  {/* Run button */}
                  <motion.button
                    type="button"
                    className="solve-ghost-button"
                    onClick={handleRun}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    Run
                  </motion.button>

                  {/* Submit button — press + shimmer via CSS */}
                  <motion.button
                    type="button"
                    className="solve-primary-button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    whileHover={{ scale: submitting ? 1 : 1.05, boxShadow: submitting ? undefined : "0 0 22px rgba(107,254,156,0.35)" }}
                    whileTap={{ scale: submitting ? 1 : 0.95 }}
                    transition={{ type: "spring", stiffness: 380, damping: 18 }}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </motion.button>
                </div>
              </div>

              <div className="solve-editor-surface">
                <Editor
                  key={selectedPreset.monacoLanguage}
                  height="100%"
                  defaultLanguage={selectedPreset.monacoLanguage}
                  language={selectedPreset.monacoLanguage}
                  theme={isDarkMode ? "vs-dark" : "vs"}
                  value={sourceCode}
                  onChange={(value) => setSourceCode(value || "")}
                  beforeMount={(monaco) => { monacoRef.current = monaco; }}
                  onMount={handleEditorMount}
                  options={{ automaticLayout: true, fontSize: 14, minimap: { enabled: false }, padding: { top: 16 }, scrollBeyondLastLine: false, smoothScrolling: true, wordWrap: "on" }}
                  loading={<div className="solve-editor-loading">Loading Monaco editor...</div>}
                />
              </div>
            </section>
          </div>

          {/* ── Bottom panel ── */}
          <section className="solve-bottom-panel">
            <div className="solve-bottom-panel__tabs">
              {["submissions", "tests", "console"].map((tab) => (
                <motion.button
                  key={tab}
                  type="button"
                  className={activePanel === tab ? "is-active" : ""}
                  onClick={() => setActivePanel(tab)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {tab === "submissions" ? "Submissions" : tab === "tests" ? "Visible Tests" : "Console"}
                </motion.button>
              ))}
            </div>

            <AnimatePresence>
              {bannerMessage && (
                <motion.div
                  className="solve-banner-message"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {bannerMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submissions — stagger new rows in */}
            {activePanel === "submissions" && (
              <motion.div
                className="solve-submission-list"
                variants={submissionStagger}
                initial="hidden"
                animate="show"
              >
                {submissions.length === 0 ? (
                  <div className="solve-empty-state">No submissions yet. The first submit will create a dummy queue entry here.</div>
                ) : (
                  submissions.map((submission) => (
                    <motion.article
                      className="solve-submission-card"
                      key={submission.submission_id}
                      variants={fadeUp}
                      transition={{ duration: 0.32 }}
                      layout
                    >
                      <div className="solve-submission-card__main">
                        <div>
                          <span className={`solve-submission-status ${getSubmissionTone(submission)}`}>
                            {formatDisplayText(submission.status || "Pending")}
                          </span>
                          <h3>{formatDisplayText(submission.language_name || "Unknown language")}</h3>
                        </div>
                        <p>Verdict: {formatDisplayText(submission.verdict || "Pending")} | User: {submission.user_id || "Guest"}</p>
                      </div>
                      <div className="solve-submission-card__meta">
                        <span>{formatDateTime(submission.submitted_at)}</span>
                        <span>ID {String(submission.submission_id).slice(0, 8)}</span>
                      </div>
                    </motion.article>
                  ))
                )}
              </motion.div>
            )}

            {activePanel === "tests" && (
              <div className="solve-bottom-grid">
                {visibleTestcases.length === 0 ? (
                  <div className="solve-empty-state">There are no visible tests for this problem right now.</div>
                ) : (
                  visibleTestcases.map((testcase, index) => (
                    <article className="solve-bottom-testcase" key={testcase.testcase_id}>
                      <h3>Sample {index + 1}</h3>
                      <label>Input</label><pre>{testcase.input_data || "(empty)"}</pre>
                      <label>Output</label><pre>{testcase.output_data || "(empty)"}</pre>
                    </article>
                  ))
                )}
              </div>
            )}

            {activePanel === "console" && (
              <div className="solve-console">
                {consoleLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
              </div>
            )}
          </section>
        </motion.section>
      </main>
    </div>
  );
}

export default ProblemSolvingPage;
