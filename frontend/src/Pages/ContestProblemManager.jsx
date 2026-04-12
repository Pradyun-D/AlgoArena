import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../Utils/api";
import LoadingPage from "./LoadingPage";
import ErrorPage from "./ErrorPage";
import "../Styles/new_problem.css";
import "../Styles/form.css";
import "../Styles/auth_pages.css";

const createEmptyTestcase = () => ({
  testcase_id: crypto.randomUUID(),
  input_data: "",
  output_data: "",
  is_hidden: true,
});

const cloneProblem = (problem) => ({
  ...problem,
  tags: Array.isArray(problem.tags) ? [...problem.tags] : [],
  testcases: Array.isArray(problem.testcases)
    ? problem.testcases.map((testcase) => ({ ...testcase }))
    : [],
});

function ContestProblemManagerPage() {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const [contest, setContest] = useState(null);
  const [problems, setProblems] = useState([]);
  const [selectedProblemId, setSelectedProblemId] = useState(null);
  const [draftProblem, setDraftProblem] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchEditorData = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await axios.get(`${API_BASE_URL}/contests/${contestId}/problems/manage`, {
          withCredentials: true,
        });
        const payload = response.data?.data;
        if (!payload?.contest) {
          throw new Error(response.data?.error || "Unable to load contest problems.");
        }

        const loadedProblems = Array.isArray(payload.problems) ? payload.problems : [];
        setContest(payload.contest);
        setProblems(loadedProblems);

        if (loadedProblems.length > 0) {
          setSelectedProblemId(loadedProblems[0].problem_id);
          setDraftProblem(cloneProblem(loadedProblems[0]));
        }
      } catch (err) {
        setError(
          err.response?.data?.error ||
          err.message ||
          "Unable to load the problem editor."
        );
      } finally {
        setLoading(false);
      }
    };

    if (contestId) {
      fetchEditorData();
    }
  }, [contestId]);

  const selectedProblem = useMemo(
    () => problems.find((problem) => problem.problem_id === selectedProblemId) || null,
    [problems, selectedProblemId]
  );

  const selectProblem = (problem) => {
    setSelectedProblemId(problem.problem_id);
    setDraftProblem(cloneProblem(problem));
    setTagInput("");
    setSuccess("");
  };

  const updateProblemField = (event) => {
    const { name, value } = event.target;
    setDraftProblem((current) => ({ ...current, [name]: value }));
  };

  const updateTestcaseField = (index, field, value) => {
    setDraftProblem((current) => ({
      ...current,
      testcases: current.testcases.map((testcase, testcaseIndex) =>
        testcaseIndex === index ? { ...testcase, [field]: value } : testcase
      ),
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || !draftProblem) {
      return;
    }

    if (draftProblem.tags.includes(tag)) {
      setTagInput("");
      return;
    }

    setDraftProblem((current) => ({
      ...current,
      tags: [...current.tags, tag],
    }));
    setTagInput("");
  };

  const removeTag = (tagIndex) => {
    setDraftProblem((current) => ({
      ...current,
      tags: current.tags.filter((_, index) => index !== tagIndex),
    }));
  };

  const addTestcase = () => {
    setDraftProblem((current) => ({
      ...current,
      testcases: [...current.testcases, createEmptyTestcase()],
    }));
  };

  const removeTestcase = (index) => {
    setDraftProblem((current) => ({
      ...current,
      testcases: current.testcases.filter((_, testcaseIndex) => testcaseIndex !== index),
    }));
  };

  const handleSave = async () => {
    if (!draftProblem) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        title: draftProblem.title,
        slug: draftProblem.slug,
        description: draftProblem.description,
        difficulty: draftProblem.difficulty,
        time_limit_ms: Number(draftProblem.time_limit_ms),
        memory_limit_kb: Number(draftProblem.memory_limit_kb),
        visibility: draftProblem.visibility,
        max_score: Number(draftProblem.max_score),
        tags: draftProblem.tags,
        testcases: draftProblem.testcases.map((testcase) => ({
          testcase_id: testcase.testcase_id,
          input_data: testcase.input_data,
          output_data: testcase.output_data,
          is_hidden: Boolean(testcase.is_hidden),
        })),
      };

      await axios.put(
        `${API_BASE_URL}/contests/${contestId}/problems/${draftProblem.problem_id}/`,
        payload,
        { withCredentials: true }
      );

      setProblems((current) =>
        current.map((problem) =>
          problem.problem_id === draftProblem.problem_id ? cloneProblem(draftProblem) : problem
        )
      );
      setSuccess("Problem changes saved successfully.");
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Unable to save the problem changes."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingPage
        title="Loading problem editor"
        subtitle="Pulling contest problem metadata, testcase inventory, and editable statement content."
      />
    );
  }

  if (error && !contest) {
    return (
      <ErrorPage
        kicker="Problem Editor Error"
        code="500"
        title="We could not open the problem editor."
        copy={error}
        primaryAction={{ label: "Back To Contest", to: `/contest/${contestId}/` }}
        secondaryAction={{ label: "View Contests", to: "/contests" }}
      />
    );
  }

  if (!draftProblem || !selectedProblem) {
    return (
      <ErrorPage
        kicker="Missing Problems"
        code="404"
        title="This contest has no editable problems yet."
        copy="Create problems for the contest first, then come back here to manage statements and testcase data."
        primaryAction={{ label: "Back To Contest", to: `/contest/${contestId}/` }}
        secondaryAction={{ label: "View Contests", to: "/contests" }}
      />
    );
  }

  return (
    <div className="problem-editor-page">
      <aside className="problem-editor-sidebar">
        <div>
          <div className="problem-editor-brand">
            <h2>AlgoArena</h2>
            <div className="problem-editor-breadcrumbs">
              <Link to="/contests">Contests</Link>
              <span>/</span>
              <span className="is-active">Problem Editor</span>
            </div>
          </div>

          <div className="problem-editor-panel-label">
            <span className="material-symbols-outlined">task</span>
            <div>
              <p>{contest?.title || "Contest"}</p>
              <span>PROBLEM MANAGEMENT CONSOLE</span>
            </div>
          </div>

          <nav className="problem-editor-nav">
            {problems.map((problem, index) => (
              <a
                href={`#problem-${problem.problem_id}`}
                key={problem.problem_id}
                className={problem.problem_id === selectedProblemId ? "active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  selectProblem(problem);
                }}
              >
                <span className="material-symbols-outlined">code_blocks</span>
                <span>{problem.title || `Problem ${index + 1}`}</span>
              </a>
            ))}
          </nav>
        </div>

        <button className="problem-editor-draft-button" onClick={() => navigate(`/contest/${contestId}/`)}>
          Return To Contest
        </button>
      </aside>

      <main className="problem-editor-main">
        <header className="problem-editor-header">
          <div>
            <h1>Edit Contest Problems</h1>
            <p>
              Update statements, timing limits, scoring, tags, and testcase sets for
              <strong> {selectedProblem.title}</strong>.
            </p>
          </div>
          <div className="problem-editor-header-actions">
            <button className="ghost-action" onClick={() => selectProblem(selectedProblem)}>
              Reset Draft
            </button>
            <button className="primary-action" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Problem"}
            </button>
          </div>
        </header>

        {error ? <p className="auth-error">{error}</p> : null}
        {success ? <p className="auth-success">{success}</p> : null}

        <section className="problem-editor-section-grid" id={`problem-${selectedProblem.problem_id}`}>
          <div className="problem-editor-section-copy">
            <p className="section-kicker">Core Fields</p>
            <h2>Update the main problem metadata and scoring details.</h2>
            <span>These values affect how the problem is presented inside the contest.</span>
          </div>

          <div className="problem-editor-card">
            <div className="field-grid two-up">
              <div className="field-group">
                <label>Title</label>
                <input name="title" value={draftProblem.title} onChange={updateProblemField} />
              </div>
              <div className="field-group">
                <label>Slug</label>
                <input name="slug" value={draftProblem.slug || ""} onChange={updateProblemField} />
              </div>
              <div className="field-group">
                <label>Difficulty</label>
                <select name="difficulty" value={draftProblem.difficulty} onChange={updateProblemField}>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </div>
              <div className="field-group">
                <label>Visibility</label>
                <select name="visibility" value={draftProblem.visibility} onChange={updateProblemField}>
                  <option value="public">public</option>
                  <option value="private">private</option>
                  <option value="contest_only">contest_only</option>
                </select>
              </div>
              <div className="field-group">
                <label>Time Limit (ms)</label>
                <input name="time_limit_ms" value={draftProblem.time_limit_ms} onChange={updateProblemField} />
              </div>
              <div className="field-group">
                <label>Memory Limit (KB)</label>
                <input name="memory_limit_kb" value={draftProblem.memory_limit_kb} onChange={updateProblemField} />
              </div>
              <div className="field-group auth-field-full">
                <label>Max Score</label>
                <input name="max_score" value={draftProblem.max_score} onChange={updateProblemField} />
              </div>
            </div>
          </div>
        </section>

        <section className="problem-editor-section-grid">
          <div className="problem-editor-section-copy">
            <p className="section-kicker">Statement</p>
            <h2>Refine the problem description and supporting markdown content.</h2>
            <span>Use this area for the main statement, notes, examples, and clarifications.</span>
          </div>

          <div className="problem-editor-card statement-card">
            <textarea
              className="problem-statement-input"
              name="description"
              value={draftProblem.description || ""}
              onChange={updateProblemField}
              placeholder="Write the full problem statement here..."
            />
          </div>
        </section>

        <section className="problem-editor-section-grid">
          <div className="problem-editor-section-copy">
            <p className="section-kicker">Tags</p>
            <h2>Keep the topic labels clean and searchable.</h2>
            <span>Add or remove tags that help classify the problem in the contest archive.</span>
          </div>

          <div className="problem-editor-card">
            <div className="field-grid">
              <div className="field-group">
                <label>Add Tag</label>
                <div className="problem-editor-header-actions">
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <button className="ghost-action" onClick={addTag}>Add Tag</button>
                </div>
              </div>

              <div className="tag-list">
                {draftProblem.tags.map((tag, index) => (
                  <span key={`${tag}-${index}`} className="tag">
                    {tag} <span className="tag-remove" onClick={() => removeTag(index)}>×</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="problem-editor-section-grid">
          <div className="problem-editor-section-copy">
            <p className="section-kicker">Testcases</p>
            <h2>Attach visible samples and hidden judge cases.</h2>
            <span>Hidden cases stay private while public ones can be used as examples in the statement.</span>
          </div>

          <div className="problem-editor-card">
            <div className="problem-editor-header-actions" style={{ marginBottom: "1rem" }}>
              <button className="primary-action" onClick={addTestcase}>Add Testcase</button>
            </div>

            <div className="field-grid">
              {draftProblem.testcases.length === 0 ? (
                <div className="problem-editor-card" style={{ background: "#111214" }}>
                  No testcases added yet. Create one to start building the judge data.
                </div>
              ) : (
                draftProblem.testcases.map((testcase, index) => (
                  <div key={testcase.testcase_id || index} className="problem-editor-card" style={{ background: "#111214" }}>
                    <div className="problem-editor-header-actions" style={{ marginBottom: "1rem", justifyContent: "space-between" }}>
                      <strong>Testcase {index + 1}</strong>
                      <button className="ghost-action" onClick={() => removeTestcase(index)}>Remove</button>
                    </div>

                    <div className="field-grid two-up">
                      <div className="field-group">
                        <label>Input Data</label>
                        <textarea
                          className="problem-statement-input"
                          style={{ minHeight: "180px" }}
                          value={testcase.input_data}
                          onChange={(event) => updateTestcaseField(index, "input_data", event.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label>Output Data</label>
                        <textarea
                          className="problem-statement-input"
                          style={{ minHeight: "180px" }}
                          value={testcase.output_data}
                          onChange={(event) => updateTestcaseField(index, "output_data", event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field-group" style={{ marginTop: "1rem" }}>
                      <label>Visibility</label>
                      <select
                        value={testcase.is_hidden ? "hidden" : "sample"}
                        onChange={(event) => updateTestcaseField(index, "is_hidden", event.target.value === "hidden")}
                      >
                        <option value="hidden">hidden</option>
                        <option value="sample">sample</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ContestProblemManagerPage;
