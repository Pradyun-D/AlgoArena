import { useState } from "react";
import { motion } from "motion/react";
import "../../Styles/new_problem.css";

const initialProblem = {
  title: "",
  difficulty: "medium",
  visibility: "public",
  tags: "",
  maxScore: "100",
  statement: "",
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0  },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1, delayChildren: 0.12 } },
};

function CreateNewProblem() {
  const [problem, setProblem] = useState(initialProblem);
  const [activeTab, setActiveTab] = useState("write");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProblem((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="problem-editor-page">

      {/* ── Sidebar ── */}
      <motion.aside
        className="problem-editor-sidebar"
        initial={{ opacity: 0, x: -22 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div>
          <div className="problem-editor-brand">
            <h2>ALGOARENA</h2>
            <div className="problem-editor-breadcrumbs">
              <span>Admin</span>
              <span>Problems</span>
              <span className="is-active">New Problem</span>
            </div>
          </div>

          <div className="problem-editor-panel-label">
            <span className="material-symbols-outlined">edit_square</span>
            <div>
              <p>Problem Editor</p>
              <span>v1.0.4-alpha</span>
            </div>
          </div>

          <nav className="problem-editor-nav" aria-label="Problem editor sections">
            {[
              { href: "#general", icon: "info", label: "General Info", active: true },
              { href: "#specification", icon: "article", label: "Specification", active: false },
            ].map(({ href, icon, label, active }, i) => (
              <motion.a
                key={href}
                href={href}
                className={active ? "active" : ""}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.09, duration: 0.35 }}
                whileHover={{ x: 3 }}
              >
                <span className="material-symbols-outlined">{icon}</span>
                <span>{label}</span>
              </motion.a>
            ))}
          </nav>
        </div>

        <motion.button
          type="button"
          className="problem-editor-draft-button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
        >
          Save Draft
        </motion.button>
      </motion.aside>

      {/* ── Main ── */}
      <main className="problem-editor-main">

        {/* Header */}
        <motion.header
          className="problem-editor-header"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div>
            <h1>Create New Challenge</h1>
            <p>Design, test, and publish a new computational problem for the arena.</p>
          </div>

          <div className="problem-editor-header-actions">
            <motion.button
              type="button"
              className="ghost-action"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              Discard Changes
            </motion.button>
            <motion.button
              type="button"
              className="primary-action"
              whileHover={{ scale: 1.04, boxShadow: "0 0 28px rgba(75,134,255,0.4)" }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              Publish Problem
            </motion.button>
          </div>
        </motion.header>

        {/* General section */}
        <motion.section
          className="problem-editor-section-grid"
          id="general"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div className="problem-editor-section-copy" variants={fadeUp} transition={{ duration: 0.4 }}>
            <p className="section-kicker">General Details</p>
            <h2>Basic identity and classification for your problem.</h2>
            <span>This is how users will discover it.</span>
          </motion.div>

          <motion.div className="problem-editor-card" variants={fadeUp} transition={{ duration: 0.4 }}>
            <div className="field-group">
              <label htmlFor="problem-title">Problem Title</label>
              <input id="problem-title" name="title" value={problem.title} onChange={handleChange} placeholder="e.g. Invert Binary Tree" type="text" />
            </div>

            <div className="field-grid two-up">
              <div className="field-group">
                <label htmlFor="problem-difficulty">Difficulty</label>
                <select id="problem-difficulty" name="difficulty" value={problem.difficulty} onChange={handleChange}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="field-group">
                <label>Visibility</label>
                <div className="segmented-toggle" role="group" aria-label="Visibility">
                  {["public", "private"].map((v) => (
                    <motion.button
                      key={v}
                      type="button"
                      className={problem.visibility === v ? "active" : ""}
                      onClick={() => setProblem((prev) => ({ ...prev, visibility: v }))}
                      whileTap={{ scale: 0.96 }}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            <div className="field-grid two-up">
              <div className="field-group">
                <label htmlFor="problem-tags">Tags</label>
                <input id="problem-tags" name="tags" value={problem.tags} onChange={handleChange} placeholder="Arrays, Trees, DP..." type="text" />
              </div>
              <div className="field-group">
                <label htmlFor="problem-max-score">Max Score</label>
                <input id="problem-max-score" name="maxScore" value={problem.maxScore} onChange={handleChange} placeholder="100" type="text" />
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* Specification section */}
        <motion.section
          className="problem-editor-section-grid"
          id="specification"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div className="problem-editor-section-copy" variants={fadeUp} transition={{ duration: 0.4 }}>
            <p className="section-kicker">Specification</p>
            <h2>Write the problem statement and expected constraints.</h2>
            <span>Keep the challenge clear, structured, and test-ready.</span>
          </motion.div>

          <motion.div className="problem-editor-card statement-card" variants={fadeUp} transition={{ duration: 0.4 }}>
            <div className="statement-toolbar">
              {["write", "preview"].map((tab) => (
                <motion.button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? "active" : ""}
                  onClick={() => setActiveTab(tab)}
                  whileTap={{ scale: 0.96 }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </motion.button>
              ))}
            </div>

            {activeTab === "write" ? (
              <textarea
                className="problem-statement-input"
                name="statement"
                value={problem.statement}
                onChange={handleChange}
                placeholder={`# Problem Statement\n\nGiven an array of integers...\n\n## Constraints\n- 1 <= n <= 10^5`}
              />
            ) : (
              <div className="problem-statement-preview">
                {problem.statement.trim()
                  ? <pre>{problem.statement}</pre>
                  : <p>Preview will appear here once you start writing the statement.</p>
                }
              </div>
            )}
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}

export default CreateNewProblem;
