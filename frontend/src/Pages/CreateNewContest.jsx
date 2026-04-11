import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import axios from 'axios';
import ErrorPage from "./ErrorPage";
import LoadingPage from "./LoadingPage";
import "../Styles/form.css"
const toUtcISOString = (localDateTimeValue) => {
  if (!localDateTimeValue) {
    return "";
  }

  const localDate = new Date(localDateTimeValue);
  if (Number.isNaN(localDate.getTime())) {
    return "";
  }

  return localDate.toISOString();
};
// ----------------IMP----------------
// form is incomplete (more fields depending on Pradyun's advice to be added later)

// ----------------TO DO-------------------------
// validate required fields before submit
// enforce a max number of problems if that’s a rule



const ContestFormPage = () => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const emptyProblem = {
    title: "",
    description: "",
    difficulty: "easy",
    time_limit_ms: "",
    memory_limit_kb: "",
    visibility: "public",
    tags: [],
    max_score: ""
  };

  const [contest, setContest] = useState({
    title: "",
    description: "",
    start_time: "",
    duration: "",
    visibility: "public"
  })

  const [problem, setProblem] = useState(emptyProblem)

  const [tagInput, setTagInput] = useState("")
  const [problems, setProblems] = useState([])
  const [editingProblemIndex, setEditingProblemIndex] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [pageError, setPageError] = useState("")

  useEffect(()=> {
    try {
      const savedContest = localStorage.getItem("contestDraft")
      const savedProblems = localStorage.getItem("problemsDraft")

      if (savedContest) {
        setContest(JSON.parse(savedContest))
      }

      if (savedProblems) {
        setProblems(JSON.parse(savedProblems))
      }
    } catch (error) {
      setPageError("We could not restore your saved contest draft. Clear the broken draft and try again.")
    } finally {
      setPageLoading(false)
    }
  },[])

  const handleContestChange = (e) => {
    const { name, value } = e.target
    setContest(prev => ({ ...prev, [name]: value }))
  }

  const handleProblemChange = (e) => {
    const { name, value } = e.target
    setProblem(prev => ({ ...prev, [name]: value }))
  }

  const addTag = () => {
    if (!tagInput.trim()) return
    if (problem.tags.includes(tagInput.trim())) return

    setProblem(prev => ({
      ...prev,
      tags: [...prev.tags, tagInput.trim()]
    }))
    setTagInput("")
  }

  const removeTag = (idx) => {
    setProblem(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== idx)
    }))
  }

  const resetProblemForm = () => {
    setProblem(emptyProblem)
    setTagInput("")
    setEditingProblemIndex(null)
  }

  const validateProblem = () => {
    const requiredFields = [
      problem.title.trim(),
      problem.difficulty.trim(),
      problem.max_score.toString().trim(),
      problem.time_limit_ms.toString().trim(),
      problem.memory_limit_kb.toString().trim()
    ]

    return requiredFields.every(Boolean)
  }

  const addProblem = () => {
    if (!validateProblem()) {
      alert("Please fill in all required problem fields before adding it.")
      return
    }

    if (editingProblemIndex !== null) {
      setProblems(prev => prev.map((item, index) => (
        index === editingProblemIndex ? { ...problem } : item
      )))
      resetProblemForm()
      return
    }

    setProblems(prev => [...prev, { ...problem }])
    resetProblemForm()
  }

  const removeProblem = (i) => {
    setProblems(prev => prev.filter((_, idx) => idx !== i))
    if (editingProblemIndex === i) {
      resetProblemForm()
    }
  }

  const editProblem = (index) => {
    setProblem({ ...problems[index] })
    setTagInput("")
    setEditingProblemIndex(index)
  }

  const calculatedEndTime = (() => {
    if (!contest.start_time || !contest.duration) {
      return ""
    }

    const start = new Date(contest.start_time)
    const durationInMinutes = Number(contest.duration)

    if (Number.isNaN(start.getTime()) || Number.isNaN(durationInMinutes)) {
      return ""
    }

    const end = new Date(start.getTime() + durationInMinutes * 60000)
    const timezoneOffset = end.getTimezoneOffset()
    const localDate = new Date(end.getTime() - timezoneOffset * 60000)
    return localDate.toISOString().slice(0, 16)
  })()

  const handleSubmit = async () => {
    if (!contest.title.trim()) {
      alert("Contest title is required.")
      return
    }

    if (!contest.start_time || !contest.duration || !calculatedEndTime) {
      alert("Please provide a valid contest start time and duration.")
      return
    }

    if (problems.length === 0) {
      alert("Add at least one problem before creating the contest.")
      return
    }

    const payload = {
      contest: {
        ...contest,
        start_time: toUtcISOString(contest.start_time),
        end_time: toUtcISOString(calculatedEndTime),
      },
      problems,
    }

    try {
     setSubmitLoading(true)
     setPageError("")
     const response = await axios.post("http://127.0.0.1:8000/contests/create/", payload, {
       withCredentials: false
     });
     console.log(response.data)
     localStorage.removeItem("contestDraft")
     localStorage.removeItem("problemsDraft")
     navigate('/contests')
    }

    catch (error) {
        console.log("error from create new contest ", error.message, error.response?.data)
        setPageError(
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Contest creation failed."
        )
    } finally {
        setSubmitLoading(false)
    }
  }

  const handleSaveDraft = () => {
    localStorage.setItem("contestDraft", JSON.stringify(contest))
    localStorage.setItem("problemsDraft", JSON.stringify(problems))
    alert("Draft saved locally!") 
  }

  if (pageLoading || submitLoading) {
    return (
      <LoadingPage
        title={submitLoading ? "Scheduling contest" : "Loading contest editor"}
        subtitle={
          submitLoading
            ? "Packaging contest metadata, validating the problem set, and sending it to the arena."
            : "Restoring your draft, contest settings, and saved problem configuration."
        }
      />
    )
  }

  if (pageError) {
    return (
      <ErrorPage
        kicker="Contest Builder Error"
        code="500"
        title="The contest editor hit a problem."
        copy={pageError}
        primaryAction={{ label: "Back To Editor", onClick: () => setPageError("") }}
        secondaryAction={{ label: "View Contests", to: "/contests" }}
      />
    )
  }

  return (
    // Applied the dynamic class here based on state
    <div className={`overlay ${isDarkMode ? 'dark-mode' : ''}`} style={{ background: 'var(--bg-body)' }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="title">CREATE NEW CONTEST</h2>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Added Theme Toggle Button */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button className="close-btn" onClick={() => navigate('/contests')}>×</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="section">
            <p className="section-title">CONTEST INFORMATION</p>
            <div className="row">
              <div className="input-group">
                <label>CONTEST TITLE</label>
                <input name="title" className="input" placeholder="e.g., Global Binary Sprint #4" value={contest.title} onChange={handleContestChange} />
              </div>
            </div>
            <div className="input-group">
              <label>DESCRIPTION (MARKDOWN SUPPORTED)</label>
              <textarea name="description" className="textarea" placeholder="Enter contest details, rules, and rewards..." value={contest.description} onChange={handleContestChange} />
              <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Use markdown like <code># Heading</code>, <code>**bold**</code>, <code>- list item</code>, and <code>[link](https://example.com)</code>. It will render in Contest Info.
              </p>
            </div>
          </div>

          <div className="section-grid">
            <div className="section">
              <p className="section-title green-dot">SCHEDULING</p>
              <div className="input-group">
                <label>START DATE & TIME</label>
                <input type="datetime-local" name="start_time" className="input" onChange={handleContestChange} value={contest.start_time} />
              </div>
              <div className="row">
                <div className="input-group">
                  <label>DURATION (MIN)</label>
                  <input name="duration" className="input" value={contest.duration} onChange={handleContestChange} />
                </div>
                <div className="input-group">
                  <label>END TIME (AUTO)</label>
                  <input className="input" value={calculatedEndTime} placeholder="Auto-calculated from start time" disabled />
                </div>
              </div>
            </div>

            <div className="section">
              <p className="section-title red-dot">CONFIGURATION</p>
              <div className="input-group">
                <label>DIFFICULTY TIER</label>
                <select className="select">
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              <div className="toggle-row">
                <div className="toggle-info">
                  <p>Private Contest</p>
                  <span>ACCESS VIA INVITATION ONLY</span>
                </div>
                <div className={`toggle ${contest.visibility === 'private' ? 'active' : ''}`} onClick={() => setContest(prev => ({...prev, visibility: prev.visibility === 'private' ? 'public' : 'private'}))}></div>
              </div>

              <div className="toggle-row">
                <div className="toggle-info">
                  <p>Auto-Publish Leaderboard</p>
                  <span style={{color: 'var(--toggle-active)'}}>LIVE UPDATES ENABLED</span>
                </div>
                <div className="toggle active"></div>
              </div>
            </div>
          </div>

          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
               <p className="section-title" style={{ margin: 0 }}>PROBLEM SELECTION</p>
               <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Selected: {problems.length}/10</span>
            </div>

            <div className="row" style={{marginBottom: '16px'}}>
              <input name="title" className="input" placeholder="Problem Title" value={problem.title} onChange={handleProblemChange} />
              <select name="difficulty" className="select" value={problem.difficulty} onChange={handleProblemChange}>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
              <input name="max_score" className="input" placeholder="Max Score" value={problem.max_score} onChange={handleProblemChange} />
            </div>

            <div className="row" style={{marginBottom: '16px'}}>
              <input name="time_limit_ms" className="input" placeholder="Time Limit (ms)" value={problem.time_limit_ms} onChange={handleProblemChange} />
              <input name="memory_limit_kb" className="input" placeholder="Memory Limit(kb)" value={problem.memory_limit_kb} onChange={handleProblemChange} />
            </div>

            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>PROBLEM DESCRIPTION</label>
              <textarea
                name="description"
                className="textarea"
                placeholder="Describe the problem statement or internal notes..."
                value={problem.description}
                onChange={handleProblemChange}
              />
            </div>

            <div className="row" style={{marginBottom: '16px', alignItems: 'center'}}>
              <input className="input" placeholder="Enter tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <button className="button button-draft" onClick={addTag}>Add Tag</button>
              <button className="button button-primary" onClick={addProblem}>
                {editingProblemIndex !== null ? "Update Problem" : "Add Problem"}
              </button>
              {editingProblemIndex !== null && (
                <button className="button button-secondary" onClick={resetProblemForm}>Cancel Edit</button>
              )}
            </div>

            <div className="tag-list">
              {problem.tags.map((t, i) => (
                <span key={i} className="tag">
                  {t} <span className="tag-remove" onClick={() => removeTag(i)}>×</span>
                </span>
              ))}
            </div>

            <div>
              {problems.map((p, i) => (
                <div key={i} className="problem-card">
                  <div className="problem-info">
                    <p>{p.title} ({p.difficulty})</p>
                    <span>{p.max_score} pts • {p.time_limit_ms}ms • {p.memory_limit_kb}kb</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="button button-draft" onClick={() => editProblem(i)}>Edit</button>
                    <button className="button button-secondary" onClick={() => removeProblem(i)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button button-secondary" onClick={()=>navigate('/contests')}>Cancel Session</button>
          <div className="footer-actions">
            <button className="button button-draft" onClick={handleSaveDraft}>Save as Draft</button>
            <button className="button button-primary" onClick={handleSubmit}>SCHEDULE CONTEST</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContestFormPage
