import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { AnimatePresence, motion } from "motion/react";
import { API_BASE_URL } from "../../Utils/api";
import ThemeToggle from "../../Components/ThemeToggle";
import { useTheme } from "../../Theme/ThemeProvider";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import "../../Styles/new_problem.css";
import "../../Styles/form.css";
import "../../Styles/auth_pages.css";

const generateTempId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'temp-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const createEmptyTestcase = () => ({
  testcase_id: generateTempId(),
  input_data: "",
  output_data: "",
  is_hidden: true,
});

const createEmptyProblem = () => ({
  problem_id: null,
  title: "",
  slug: "",
  description: "",
  difficulty: "easy",
  time_limit_ms: "",
  memory_limit_kb: "",
  visibility: "contest_only",
  max_score: "",
  tags: [],
  testcases: [],
});

const cloneProblem = (problem) => ({
  ...problem,
  tags: Array.isArray(problem.tags) ? [...problem.tags] : [],
  testcases: Array.isArray(problem.testcases)
    ? problem.testcases.map((testcase) => ({ ...testcase }))
    : [],
});

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const slideIn = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0 },
};

const stagger = (delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: delay } },
});

const buttonMotion = {
  whileHover: { scale: 1.03, y: -1 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 380, damping: 18 },
};

function ContestProblemManagerPage() {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [contest, setContest] = useState(null);
  const [problems, setProblems] = useState([]);
  const [selectedProblemId, setSelectedProblemId] = useState(null);
  const [draftProblem, setDraftProblem] = useState(createEmptyProblem());
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
        } else {
          setSelectedProblemId(null);
          setDraftProblem(createEmptyProblem());
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

  const startNewProblem = () => {
    setSelectedProblemId(null);
    setDraftProblem(createEmptyProblem());
    setTagInput("");
    setError("");
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

      if (draftProblem.problem_id) {
        await axios.put(
          `${API_BASE_URL}/contests/${contestId}/problems/${draftProblem.problem_id}/update`,
          payload,
          { withCredentials: true }
        );

        setProblems((current) =>
          current.map((problem) =>
            problem.problem_id === draftProblem.problem_id ? cloneProblem(draftProblem) : problem
          )
        );
      } else {
        const response = await axios.post(
          `${API_BASE_URL}/contests/${contestId}/problems/create`,
          payload,
          { withCredentials: true }
        );

        const createdProblem = response.data?.problem
          ? cloneProblem(response.data.problem)
          : { ...cloneProblem(draftProblem), problem_id: generateTempId() };

        setProblems((current) => [...current, createdProblem]);
        setSelectedProblemId(createdProblem.problem_id);
        setDraftProblem(cloneProblem(createdProblem));
      }
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

  const activeProblem = selectedProblem || draftProblem;
  const isCreatingProblem = !selectedProblem;

  return (
    <div className={`problem-editor-page ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <motion.aside
        className="problem-editor-sidebar"
        initial={{ opacity: 0, x: -22 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div>
          <motion.div
            className="problem-editor-brand"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <h2>AlgoArena</h2>
            <div className="problem-editor-breadcrumbs">
              <Link to="/contests">Contests</Link>
              <span>/</span>
              <span className="is-active">Problem Editor</span>
            </div>
          </motion.div>

          <motion.div
            className="problem-editor-panel-label"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.35 }}
          >
            <span className="material-symbols-outlined">task</span>
            <div>
              <p>{contest?.title || "Contest"}</p>
              <span>PROBLEM MANAGEMENT CONSOLE</span>
            </div>
          </motion.div>

          <motion.button
            className="problem-editor-draft-button"
            onClick={startNewProblem}
            {...buttonMotion}
            style={{ marginTop: "1rem" }}
          >
            Add New Problem
          </motion.button>

          <motion.nav
            className="problem-editor-nav"
            variants={stagger(0.22)}
            initial="hidden"
            animate="show"
          >
            {problems.length > 0 ? (
              problems.map((problem, index) => (
                <motion.a
                  href={`#problem-${problem.problem_id}`}
                  key={problem.problem_id}
                  className={problem.problem_id === selectedProblemId ? "active" : ""}
                  variants={slideIn}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(event) => {
                    event.preventDefault();
                    selectProblem(problem);
                  }}
                >
                  <span className="material-symbols-outlined">code_blocks</span>
                  <span>{problem.title || `Problem ${index + 1}`}</span>
                </motion.a>
              ))
            ) : (
              <motion.div className="problem-editor-empty-state" variants={slideIn}>
                <p>No problems have been added yet.</p>
                <span>Start the first one with the button above.</span>
              </motion.div>
            )}
          </motion.nav>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <motion.button
            className="problem-editor-draft-button"
            onClick={() => navigate(`/contest/${contestId}/`)}
            {...buttonMotion}
          >
            Return To Contest
          </motion.button>
          <ThemeToggle />
        </div>
      </motion.aside>

      <main className="problem-editor-main">
        <motion.header
          className="problem-editor-header"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.42, ease: "easeOut" }}
        >
          <div>
            <h1>Edit Contest Problems</h1>
            <p>
              {isCreatingProblem
                ? "Create the first problem for this contest, then continue editing it below."
                : "Update statements, timing limits, scoring, tags, and testcase sets for"}
              {!isCreatingProblem ? <strong> {activeProblem?.title}</strong> : null}
            </p>
          </div>
          <div className="problem-editor-header-actions">
            <motion.button className="ghost-action" onClick={startNewProblem} {...buttonMotion}>
              New Problem
            </motion.button>
            <motion.button
              className="ghost-action"
              onClick={selectedProblem ? () => selectProblem(selectedProblem) : startNewProblem}
              {...buttonMotion}
            >
              Reset Draft
            </motion.button>
            <motion.button
              className="primary-action"
              onClick={handleSave}
              disabled={saving}
              whileHover={saving ? undefined : { scale: 1.03, y: -1, boxShadow: "0 0 26px rgba(99, 241, 165, 0.28)" }}
              whileTap={saving ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              {saving ? "Saving..." : isCreatingProblem ? "Create Problem" : "Save Problem"}
            </motion.button>
          </div>
        </motion.header>

        <AnimatePresence>
          {error ? (
            <motion.p className="auth-error" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }}>
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {success ? (
            <motion.p className="auth-success" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }}>
              {success}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <motion.section
          className="problem-editor-section-grid"
          id={activeProblem?.problem_id ? `problem-${activeProblem.problem_id}` : "problem-new"}
          variants={stagger(0.16)}
          initial="hidden"
          animate="show"
        >
          <motion.div className="problem-editor-section-copy" variants={fadeUp}>
            <p className="section-kicker">Core Fields</p>
            <h2>Update the main problem metadata and scoring details.</h2>
            <span>These values affect how the problem is presented inside the contest.</span>
          </motion.div>

          <motion.div className="problem-editor-card" variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
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
                  <option value="contest_only">contest only</option>
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
          </motion.div>
        </motion.section>

        <motion.section className="problem-editor-section-grid" variants={stagger()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.18 }}>
          <motion.div className="problem-editor-section-copy" variants={fadeUp}>
            <p className="section-kicker">Statement</p>
            <h2>Refine the problem description and supporting markdown content.</h2>
            <span>Use this area for the main statement, notes, examples, and clarifications.</span>
          </motion.div>

          <motion.div className="problem-editor-card statement-card" variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
            <textarea
              className="problem-statement-input"
              name="description"
              value={draftProblem.description || ""}
              onChange={updateProblemField}
              placeholder="Write the full problem statement here..."
            />
          </motion.div>
        </motion.section>

        <motion.section className="problem-editor-section-grid" variants={stagger()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.18 }}>
          <motion.div className="problem-editor-section-copy" variants={fadeUp}>
            <p className="section-kicker">Tags</p>
            <h2>Keep the topic labels clean and searchable.</h2>
            <span>Add or remove tags that help classify the problem in the contest archive.</span>
          </motion.div>

          <motion.div className="problem-editor-card" variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
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
                  <motion.button className="ghost-action" onClick={addTag} {...buttonMotion}>Add Tag</motion.button>
                </div>
              </div>

              <motion.div className="tag-list" layout>
                {draftProblem.tags.map((tag, index) => (
                  <motion.span key={`${tag}-${index}`} className="tag" layout initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }}>
                    {tag} <span className="tag-remove" onClick={() => removeTag(index)}>×</span>
                  </motion.span>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </motion.section>

        <motion.section className="problem-editor-section-grid" variants={stagger()} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.14 }}>
          <motion.div className="problem-editor-section-copy" variants={fadeUp}>
            <p className="section-kicker">Testcases</p>
            <h2>Attach visible samples and hidden judge cases.</h2>
            <span>Hidden cases stay private while public ones can be used as examples in the statement.</span>
          </motion.div>

          <motion.div className="problem-editor-card" variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
            <div className="problem-editor-header-actions" style={{ marginBottom: "1rem" }}>
              <motion.button className="primary-action" onClick={addTestcase} {...buttonMotion}>Add Testcase</motion.button>
            </div>

            <motion.div className="field-grid" layout>
              {draftProblem.testcases.length === 0 ? (
                <motion.div
                  className="problem-editor-card"
                  style={
                    isDarkMode
                      ? { background: "#111214" }
                      : { background: "rgba(255, 255, 255, 0.98)", color: "#132033" }
                  }
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  No testcases added yet. Create one to start building the judge data.
                </motion.div>
              ) : (
                draftProblem.testcases.map((testcase, index) => (
                  <motion.div
                    key={testcase.testcase_id || index}
                    className="problem-editor-card"
                    style={
                      isDarkMode
                        ? { background: "#111214" }
                        : { background: "rgba(255, 255, 255, 0.98)", color: "#132033" }
                    }
                    layout
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    <div className="problem-editor-header-actions" style={{ marginBottom: "1rem", justifyContent: "space-between" }}>
                      <strong>Testcase {index + 1}</strong>
                      <motion.button className="ghost-action" onClick={() => removeTestcase(index)} {...buttonMotion}>Remove</motion.button>
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
                  </motion.div>
                ))
              )}
            </motion.div>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}

export default ContestProblemManagerPage;
