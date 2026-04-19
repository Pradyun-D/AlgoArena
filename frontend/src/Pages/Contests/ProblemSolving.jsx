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

const LANGUAGE_PRESETS = [
  {
    match: (name) => /c\+\+|clang/i.test(name),
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
  {
    match: (name) => /^c#|csharp/i.test(name),
    monacoLanguage: "csharp",
    starterCode: `using System;

public class Program {
    public static void Main(string[] args) {
    }
}
`,
  },
  {
    match: (name) => /^c(\s|\(|$)/i.test(name),
    monacoLanguage: "c",
    starterCode: `#include <stdio.h>

int main(void) {
    return 0;
}
`,
  },
  {
    match: (name) => /visual basic|vb\.net|vbnc/i.test(name),
    monacoLanguage: "vb",
    starterCode: `Module Program
    Sub Main(args As String())
    End Sub
End Module
`,
  },
  {
    match: (name) => /\bbasic\b/i.test(name),
    monacoLanguage: "basic",
    starterCode: `PRINT "Hello, world!"
`,
  },
  {
    match: (name) => /assembly|nasm/i.test(name),
    monacoLanguage: "asm",
    starterCode: `section .text
global _start

_start:
`,
  },
  {
    match: (name) => /javascript/i.test(name),
    monacoLanguage: "javascript",
    starterCode: `function main() {
  // write your solution here
}
`,
  },
  {
    match: (name) => /typescript/i.test(name),
    monacoLanguage: "typescript",
    starterCode: `function main(): void {
  // write your solution here
}
`,
  },
  {
    match: (name) => /java(?!script)/i.test(name),
    monacoLanguage: "java",
    starterCode: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
    }
}
`,
  },
  {
    match: (name) => /python/i.test(name),
    monacoLanguage: "python",
    starterCode: `def solve():
    pass


if __name__ == "__main__":
    solve()
`,
  },
  {
    match: (name) => /rust/i.test(name),
    monacoLanguage: "rust",
    starterCode: `fn main() {
    // write your solution here
}
`,
  },
  {
    match: (name) => /\bgo\b|golang/i.test(name),
    monacoLanguage: "go",
    starterCode: `package main

func main() {
}
`,
  },
  {
    match: (name) => /kotlin/i.test(name),
    monacoLanguage: "kotlin",
    starterCode: `fun main() {
    // write your solution here
}
`,
  },
  {
    match: (name) => /swift/i.test(name),
    monacoLanguage: "swift",
    starterCode: `import Foundation

// write your solution here
`,
  },
  {
    match: (name) => /\bphp\b/i.test(name),
    monacoLanguage: "php",
    starterCode: `<?php
// write your solution here
`,
  },
  {
    match: (name) => /\bruby\b/i.test(name),
    monacoLanguage: "ruby",
    starterCode: `def solve
end

solve
`,
  },
  {
    match: (name) => /\bscala\b/i.test(name),
    monacoLanguage: "scala",
    starterCode: `object Main extends App {
}
`,
  },
  {
    match: (name) => /\bsql\b/i.test(name),
    monacoLanguage: "sql",
    starterCode: `SELECT 1;
`,
  },
  {
    match: (name) => /bash|shell/i.test(name),
    monacoLanguage: "shell",
    starterCode: `#!/usr/bin/env bash

`,
  },
  {
    match: (name) => /\blua\b/i.test(name),
    monacoLanguage: "lua",
    starterCode: `function main()
end
`,
  },
  {
    match: (name) => /\bperl\b/i.test(name),
    monacoLanguage: "perl",
    starterCode: `#!/usr/bin/env perl
use strict;
use warnings;
`,
  },
  {
    match: (name) => /^r(\s|\(|$)/i.test(name),
    monacoLanguage: "r",
    starterCode: `main <- function() {
}
`,
  },
  {
    match: (name) => /objective-?c/i.test(name),
    monacoLanguage: "objective-c",
    starterCode: `#import <Foundation/Foundation.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
    }
    return 0;
}
`,
  },
  {
    match: (name) => /\bpascal\b/i.test(name),
    monacoLanguage: "pascal",
    starterCode: `program Main;
begin
end.
`,
  },
  {
    match: (name) => /\bfortran\b/i.test(name),
    monacoLanguage: "fortran",
    starterCode: `program main
end program main
`,
  },
  {
    match: (name) => /\bhaskell\b/i.test(name),
    monacoLanguage: "haskell",
    starterCode: `main :: IO ()
main = do
`,
  },
  {
    match: (name) => /\blisp\b/i.test(name),
    monacoLanguage: "lisp",
    starterCode: `(defun main ()
)
`,
  },
  {
    match: (name) => /\belixir\b/i.test(name),
    monacoLanguage: "elixir",
    starterCode: `defmodule Main do
end
`,
  },
  {
    match: (name) => /\berlang\b/i.test(name),
    monacoLanguage: "erlang",
    starterCode: `-module(main).
-export([main/0]).
main() ->
    ok.
`,
  },
  {
    match: (name) => /\bclojure\b/i.test(name),
    monacoLanguage: "clojure",
    starterCode: `(ns main)
`,
  },
  {
    match: (name) => /\bgroovy\b/i.test(name),
    monacoLanguage: "groovy",
    starterCode: `def main() {
}
`,
  },
  {
    match: (name) => /\bf#|fsharp/i.test(name),
    monacoLanguage: "fsharp",
    starterCode: `module Main
`,
  },
  {
    match: (name) => /\bcobol\b/i.test(name),
    monacoLanguage: "cobol",
    starterCode: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. MAIN.
       STOP RUN.
`,
  },
  {
    match: (name) => /\bprolog\b/i.test(name),
    monacoLanguage: "prolog",
    starterCode: `main :- true.
`,
  },
  {
    match: (name) => /\bocaml\b/i.test(name),
    monacoLanguage: "ocaml",
    starterCode: `let () =
  ()
`,
  },
  {
    match: (name) => /\bd\b/i.test(name),
    monacoLanguage: "d",
    starterCode: `import std.stdio;

void main() {
}
`,
  },
];

const FALLBACK_CONSOLE_LINES = [
  "Judge connection is not wired yet.",
  "Use Run for the mock console view.",
  "Use Submit to create a submission entry only.",
];

const getLanguagePreset = (languageName) =>
  LANGUAGE_PRESETS.find((preset) => preset.match(languageName || "")) || { monacoLanguage: "plaintext", starterCode: "" };

const normalizeDifficulty = (difficulty) => {
  const value = String(difficulty || "").toLowerCase().trim();
  if (value === "easy") return "is-easy";
  if (value === "medium") return "is-medium";
  if (value === "hard") return "is-hard";
  return "";
};

const getSubmissionTone = (submission) => {
  const verdict = submission?.verdict;

  if (verdict === "Accepted") {
    return "is-complete"; // Green
  }

  if (verdict === "Wrong Answer") {
    return "is-error"; // Red
  }
  return "is-warning"; // Orange
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
  show: { opacity: 1, y: 0 },
};

const submissionStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
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
  const visibleTestcases = useMemo(() => Array.isArray(solveData?.visible_testcases) ? solveData.visible_testcases : [], [solveData]);
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
        const response = await axios.get(`${API_BASE_URL}/contests/${contestId}/problems/${problemId}/solve`, { withCredentials: true });
        
        const data = response.data?.data;
        if (data) {
          setSolveData(data);
          
          if (Array.isArray(data.languages)) {
            setLanguages(data.languages);
            if (data.languages.length > 0) {
              setSelectedLanguageId(String(data.languages[0].language_id));
              setSourceCode(getLanguagePreset(data.languages[0].name).starterCode);
            }
          }
          
          if (Array.isArray(data.submissions)) {
            setSubmissions(data.submissions);
          }
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Unable to load problem.");
        setErrorStatus(err.response?.status ?? null);
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
        "Submission sent to the judge. Status will update shortly.",
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
                    <select style={{ minWidth: "300px" }} value={selectedLanguageId} onChange={handleLanguageChange}>
                      {languages.map((language) => (
                        <option key={language.language_id} value={language.language_id}>{language.name}</option>
                      ))}
                    </select>
                  </label>
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
                  options={{
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: false },
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    wordWrap: "on",
                  }}
                  loading={<div className="solve-editor-loading">Loading editor...</div>}
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
                  <div className="solve-empty-state" style={{ margin: "1rem" }}>
                    No submissions yet.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="cf-submissions-table">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Language</th>
                          <th>Verdict</th>
                          <th>Time</th>
                          <th>Memory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map((submission) => (
                          <tr key={submission.submission_id}>
                            <td>
                              <div className="cf-submissions-when">
                                {formatDateTime(submission.submitted_at)}
                              </div>
                            </td>
                            <td>{formatDisplayText(submission.language_name || "Unknown")}</td>
                            <td className={`cf-submissions-verdict ${getSubmissionTone(submission)}`}>
                              {formatDisplayText(submission.verdict || submission.status || "Pending")}
                            </td>
                            <td>{submission.execution_time_ms || 0} ms</td>
                            <td>{submission.memory_used_kb || 0} KB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
