import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import ErrorPage from "./ErrorPage";
import LoadingPage from "./LoadingPage";
import "../Styles/problem_solving.css";
import { getStoredAuthUser } from "../Utils/auth_storage";
import { API_BASE_URL } from "../Utils/api";
import { formatDisplayText } from "../Utils/format_display_text";

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
  LANGUAGE_PRESETS[languageName] || {
    monacoLanguage: "plaintext",
    starterCode: "",
  };

const formatDateTime = (value) => {
  if (!value) {
    return "Just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeDifficulty = (difficulty) => {
  const normalized = String(difficulty || "medium").toLowerCase();

  if (normalized === "easy") {
    return "is-easy";
  }

  if (normalized === "hard") {
    return "is-hard";
  }

  return "is-medium";
};

const getSubmissionTone = (submission) => {
  if (submission?.status === "Completed") {
    return "is-complete";
  }

  if (submission?.status === "System_Error") {
    return "is-error";
  }

  return "is-pending";
};

function ProblemSolvingPage() {
  const { contestId, problemId } = useParams();
  const [solveData, setSolveData] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [consoleLines, setConsoleLines] = useState(FALLBACK_CONSOLE_LINES);
  const [activePanel, setActivePanel] = useState("submissions");
  const [selectedLanguageId, setSelectedLanguageId] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bannerMessage, setBannerMessage] = useState("");
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  useEffect(() => {
    const fetchSolveData = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await axios.get(
          `${API_BASE_URL}/contests/${contestId}/problems/${problemId}/solve`
        );

        const payload = response.data?.data;
        if (!payload?.problem) {
          throw new Error(response.data?.error || "Unable to load this problem.");
        }

        setSolveData(payload);
        setSubmissions(Array.isArray(payload.submissions) ? payload.submissions : []);

        const firstLanguage = Array.isArray(payload.languages) ? payload.languages[0] : null;
        if (firstLanguage) {
          setSelectedLanguageId(String(firstLanguage.language_id));
          setSourceCode(getLanguagePreset(firstLanguage.name).starterCode);
        }
      } catch (err) {
        setError(
          err.response?.data?.error ||
          err.message ||
          "Unable to open the problem workspace."
        );
      } finally {
        setLoading(false);
      }
    };

    if (contestId && problemId) {
      fetchSolveData();
    }
  }, [contestId, problemId]);

  useEffect(() => {
    const syncAuthUser = () => setAuthUser(getStoredAuthUser());
    window.addEventListener("storage", syncAuthUser);
    return () => window.removeEventListener("storage", syncAuthUser);
  }, []);

  const languages = useMemo(() => solveData?.languages || [], [solveData]);
  const visibleTestcases = solveData?.visible_testcases || [];
  const selectedLanguage = useMemo(
    () =>
      languages.find((language) => String(language.language_id) === String(selectedLanguageId)) ||
      languages[0] ||
      null,
    [languages, selectedLanguageId]
  );

  const selectedPreset = getLanguagePreset(selectedLanguage?.name);
  const problem = solveData?.problem || null;
  const contest = solveData?.contest || null;
  const canManageProblems = Boolean(authUser && ["problem_setter", "admin"].includes(authUser.role));

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    const model = editorRef.current.getModel();
    if (!model) {
      return;
    }

    monacoRef.current.editor.setModelLanguage(model, selectedPreset.monacoLanguage);
  }, [selectedPreset.monacoLanguage]);

  const handleLanguageChange = (event) => {
    const nextLanguageId = event.target.value;
    const nextLanguage = languages.find(
      (language) => String(language.language_id) === String(nextLanguageId)
    );

    setSelectedLanguageId(nextLanguageId);
    setBannerMessage("");

    if (nextLanguage) {
      setSourceCode(getLanguagePreset(nextLanguage.name).starterCode);
    }
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, selectedPreset.monacoLanguage);
    }
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
      setSubmitting(true);
      setBannerMessage("");
      setActivePanel("submissions");

      const response = await axios.post(
        `${API_BASE_URL}/contests/${contestId}/problems/${problemId}/submit`,
        {
          language_id: Number(selectedLanguage.language_id),
          language_name: selectedLanguage.name,
          source_code: sourceCode,
        },
        { withCredentials: true }
      );

      const newSubmission = response.data?.data;
      if (newSubmission) {
        setSubmissions((current) => [newSubmission, ...current]);
      }

      setConsoleLines((current) => [
        `[${new Date().toLocaleTimeString("en-IN")}] Submission queued for ${selectedLanguage.name}.`,
        "Judge execution is still mocked, so the row is added without running tests.",
        ...current,
      ]);
      setBannerMessage("Submission added to the list.");
    } catch (err) {
      setBannerMessage(
        err.response?.data?.error ||
        (err.request ? "Submission was blocked before the server response reached the browser. Check backend CORS and reload both servers." : "") ||
        err.message ||
        "Unable to add the submission right now."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <LoadingPage
        title="Loading problem workspace"
        subtitle="Preparing the statement, visible samples, editor session, and recent submissions."
      />
    );
  }

  if (error || !problem) {
    return (
      <ErrorPage
        kicker="Workspace Error"
        code="500"
        title="The problem workspace could not be opened."
        copy={error || "Problem details are unavailable for this contest."}
        primaryAction={{ label: "Back To Contest", to: `/contest/${contestId}/` }}
        secondaryAction={{ label: "View Contests", to: "/contests" }}
      />
    );
  }

  return (
    <div className="solve-page-shell">
      <header className="solve-topbar">
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
          <Link to={`/contest/${contestId}/`} className="solve-header-link">
            Contest
          </Link>
          {canManageProblems ? (
            <Link to={`/contest/${contestId}/problems/edit`} className="solve-header-link">
              Manage
            </Link>
          ) : null}
        </div>
      </header>

      <main className="solve-layout">
        <aside className="solve-sidebar">
          <div className="solve-sidebar__contest">
            <span className="solve-sidebar__eyebrow">Live Workspace</span>
            <h2>{contest?.title || "Contest Problem"}</h2>
            <p>Read the statement, code beside it, and track submissions in one place.</p>
          </div>

          <div className="solve-sidebar__meta">
            <div>
              <span>Difficulty</span>
              <strong className={normalizeDifficulty(problem.difficulty)}>
                {problem.difficulty}
              </strong>
            </div>
            <div>
              <span>Time Limit</span>
              <strong>{problem.time_limit_ms} ms</strong>
            </div>
            <div>
              <span>Memory Limit</span>
              <strong>{problem.memory_limit_kb} KB</strong>
            </div>
            <div>
              <span>Score</span>
              <strong>{problem.max_score ?? "N/A"}</strong>
            </div>
          </div>

          <div className="solve-sidebar__tags">
            {(problem.tags || []).length > 0 ? (
              problem.tags.map((tag) => (
                <span className="solve-tag" key={tag}>
                  {tag}
                </span>
              ))
            ) : (
              <span className="solve-tag is-muted">No tags</span>
            )}
          </div>

          <div className="solve-sidebar__notes">
            <p>Visible tests: {visibleTestcases.length}</p>
            <p>Hidden tests: {solveData?.hidden_testcase_count || 0}</p>
            <p>Submissions loaded: {submissions.length}</p>
          </div>
        </aside>

        <section className="solve-workspace">
          <div className="solve-panels">
            <article className="solve-problem-panel">
              <div className="solve-panel-header">
                <div>
                  <span className="solve-panel-kicker">Problem</span>
                  <h1>{problem.title}</h1>
                </div>
                <div className={`solve-difficulty-pill ${normalizeDifficulty(problem.difficulty)}`}>
                  {problem.difficulty}
                </div>
              </div>

              <div className="solve-panel-stats">
                <div>
                  <span className="material-symbols-outlined">timer</span>
                  <span>{problem.time_limit_ms} ms</span>
                </div>
                <div>
                  <span className="material-symbols-outlined">memory</span>
                  <span>{problem.memory_limit_kb} KB</span>
                </div>
                <div>
                  <span className="material-symbols-outlined">visibility</span>
                  <span>{problem.visibility}</span>
                </div>
              </div>

              <div className="solve-markdown">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {problem.description || "This problem does not have a published description yet."}
                </ReactMarkdown>
              </div>

              <div className="solve-samples">
                <div className="solve-samples__header">
                  <div>
                    <span className="solve-panel-kicker">Visible Testcases</span>
                  </div>
                  <span className="solve-sample-note">
                    {solveData?.hidden_testcase_count || 0} hidden testcase(s) stay private
                  </span>
                </div>

                {visibleTestcases.length === 0 ? (
                  <div className="solve-empty-state">
                    No visible testcases were published for this problem yet.
                  </div>
                ) : (
                  <div className="solve-sample-grid">
                    {visibleTestcases.map((testcase, index) => (
                      <section className="solve-sample-card" key={testcase.testcase_id}>
                        <h3>Example {index + 1}</h3>
                        <div className="solve-sample-io">
                          <div>
                            <label>Input</label>
                            <pre>{testcase.input_data || "(empty)"}</pre>
                          </div>
                          <div>
                            <label>Output</label>
                            <pre>{testcase.output_data || "(empty)"}</pre>
                          </div>
                        </div>
                      </section>
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
                        <option key={language.language_id} value={language.language_id}>
                          {language.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="solve-editor-hint">
                    Monaco editor enabled
                  </span>
                </div>

                <div className="solve-editor-toolbar__actions">
                  <button type="button" className="solve-ghost-button" onClick={handleRun}>
                    Run
                  </button>
                  <button
                    type="button"
                    className="solve-primary-button"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>

              <div className="solve-editor-surface">
                <Editor
                  key={selectedPreset.monacoLanguage}
                  height="100%"
                  defaultLanguage={selectedPreset.monacoLanguage}
                  language={selectedPreset.monacoLanguage}
                  theme="vs-dark"
                  value={sourceCode}
                  onChange={(value) => setSourceCode(value || "")}
                  beforeMount={(monaco) => {
                    monacoRef.current = monaco;
                  }}
                  onMount={handleEditorMount}
                  options={{
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: false },
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    wordWrap: "on",
                  }}
                  loading={<div className="solve-editor-loading">Loading Monaco editor...</div>}
                />
              </div>
            </section>
          </div>

          <section className="solve-bottom-panel">
            <div className="solve-bottom-panel__tabs">
              <button
                type="button"
                className={activePanel === "submissions" ? "is-active" : ""}
                onClick={() => setActivePanel("submissions")}
              >
                Submissions
              </button>
              <button
                type="button"
                className={activePanel === "tests" ? "is-active" : ""}
                onClick={() => setActivePanel("tests")}
              >
                Visible Tests
              </button>
              <button
                type="button"
                className={activePanel === "console" ? "is-active" : ""}
                onClick={() => setActivePanel("console")}
              >
                Console
              </button>
            </div>

            {bannerMessage ? (
              <div className="solve-banner-message">{bannerMessage}</div>
            ) : null}

            {activePanel === "submissions" ? (
              <div className="solve-submission-list">
                {submissions.length === 0 ? (
                  <div className="solve-empty-state">
                    No submissions yet. The first submit will create a dummy queue entry here.
                  </div>
                ) : (
                  submissions.map((submission) => (
                    <article className="solve-submission-card" key={submission.submission_id}>
                      <div className="solve-submission-card__main">
                        <div>
                          <span className={`solve-submission-status ${getSubmissionTone(submission)}`}>
                            {formatDisplayText(submission.status || "Pending")}
                          </span>
                          <h3>{formatDisplayText(submission.language_name || "Unknown language")}</h3>
                        </div>
                        <p>
                          Verdict: {formatDisplayText(submission.verdict || "Pending")} | User: {submission.user_id || "Guest"}
                        </p>
                      </div>
                      <div className="solve-submission-card__meta">
                        <span>{formatDateTime(submission.submitted_at)}</span>
                        <span>ID {String(submission.submission_id).slice(0, 8)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {activePanel === "tests" ? (
              <div className="solve-bottom-grid">
                {visibleTestcases.length === 0 ? (
                  <div className="solve-empty-state">
                    There are no visible tests for this problem right now.
                  </div>
                ) : (
                  visibleTestcases.map((testcase, index) => (
                    <article className="solve-bottom-testcase" key={testcase.testcase_id}>
                      <h3>Sample {index + 1}</h3>
                      <label>Input</label>
                      <pre>{testcase.input_data || "(empty)"}</pre>
                      <label>Output</label>
                      <pre>{testcase.output_data || "(empty)"}</pre>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {activePanel === "console" ? (
              <div className="solve-console">
                {consoleLines.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
            ) : null}
          </section>
        </section>
      </main>
    </div>
  );
}

export default ProblemSolvingPage;
