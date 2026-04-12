import { useState } from "react";
import "../Styles/new_problem.css";

const initialProblem = {
  title: "",
  difficulty: "medium",
  visibility: "public",
  tags: "",
  maxScore: "100",
  statement: "",
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
      <aside className="problem-editor-sidebar">
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
            <span className="material-symbols-outlined">Edit Square</span>
            <div>
              <p>Problem Editor</p>
              <span>v1.0.4-alpha</span>
            </div>
          </div>

          <nav className="problem-editor-nav" aria-label="Problem editor sections">
            <a href="#general" className="active">
              <span className="material-symbols-outlined">info</span>
              <span>General Info</span>
            </a>
            <a href="#specification">
              <span className="material-symbols-outlined">article</span>
              <span>Specification</span>
            </a>
          </nav>
        </div>

        <button type="button" className="problem-editor-draft-button">
          Save Draft
        </button>
      </aside>

      <main className="problem-editor-main">
        <header className="problem-editor-header">
          <div>
            <h1>Create New Challenge</h1>
            <p>
              Design, test, and publish a new computational problem for the arena.
            </p>
          </div>

          <div className="problem-editor-header-actions">
            <button type="button" className="ghost-action">Discard Changes</button>
            <button type="button" className="primary-action">Publish Problem</button>
          </div>
        </header>

        <section className="problem-editor-section-grid" id="general">
          <div className="problem-editor-section-copy">
            <p className="section-kicker">General Details</p>
            <h2>Basic identity and classification for your problem.</h2>
            <span>This is how users will discover it.</span>
          </div>

          <div className="problem-editor-card">
            <div className="field-group">
              <label htmlFor="problem-title">Problem Title</label>
              <input
                id="problem-title"
                name="title"
                value={problem.title}
                onChange={handleChange}
                placeholder="e.g. Invert Binary Tree"
                type="text"
              />
            </div>

            <div className="field-grid two-up">
              <div className="field-group">
                <label htmlFor="problem-difficulty">Difficulty</label>
                <select
                  id="problem-difficulty"
                  name="difficulty"
                  value={problem.difficulty}
                  onChange={handleChange}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="field-group">
                <label>Visibility</label>
                <div className="segmented-toggle" role="group" aria-label="Visibility">
                  <button
                    type="button"
                    className={problem.visibility === "public" ? "active" : ""}
                    onClick={() => setProblem((prev) => ({ ...prev, visibility: "public" }))}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    className={problem.visibility === "private" ? "active" : ""}
                    onClick={() => setProblem((prev) => ({ ...prev, visibility: "private" }))}
                  >
                    Private
                  </button>
                </div>
              </div>
            </div>

            <div className="field-grid two-up">
              <div className="field-group">
                <label htmlFor="problem-tags">Tags</label>
                <input
                  id="problem-tags"
                  name="tags"
                  value={problem.tags}
                  onChange={handleChange}
                  placeholder="Arrays, Trees, DP..."
                  type="text"
                />
              </div>

              <div className="field-group">
                <label htmlFor="problem-max-score">Max Score</label>
                <input
                  id="problem-max-score"
                  name="maxScore"
                  value={problem.maxScore}
                  onChange={handleChange}
                  placeholder="100"
                  type="text"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="problem-editor-section-grid" id="specification">
          <div className="problem-editor-section-copy">
            <p className="section-kicker">Specification</p>
            <h2>Write the problem statement and expected constraints.</h2>
            <span>Keep the challenge clear, structured, and test-ready.</span>
          </div>

          <div className="problem-editor-card statement-card">
            <div className="statement-toolbar">
              <button
                type="button"
                className={activeTab === "write" ? "active" : ""}
                onClick={() => setActiveTab("write")}
              >
                Write
              </button>
              <button
                type="button"
                className={activeTab === "preview" ? "active" : ""}
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </button>
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
                {problem.statement.trim() ? (
                  <pre>{problem.statement}</pre>
                ) : (
                  <p>Preview will appear here once you start writing the statement.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default CreateNewProblem;
