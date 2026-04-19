import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import axios from 'axios';
import { API_BASE_URL } from "../../Utils/api";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import ThemeToggle from "../../Components/ThemeToggle";
import { useTheme } from "../../Theme/ThemeProvider";
import "../../Styles/form.css"
import { parseSafeUTCDate } from "../../Utils/date_helpers";

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

const getDraftContestStorageKey = (id) => (id ? `contestDraft:${id}` : "contestDraft:temp");
const getDraftProblemsStorageKey = (id) => (id ? `problemsDraft:${id}` : "problemsDraft:temp");
// ----------------IMP----------------
// form is incomplete (more fields depending on Pradyun's advice to be added later)

// ----------------TO DO-------------------------
// validate required fields before submit
// enforce a max number of problems if that’s a rule



const ContestFormPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const contestId = searchParams.get("contest");
  const isContestEditMode = Boolean(contestId);
  const { isDarkMode } = useTheme();
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
  const [submitMode, setSubmitMode] = useState("schedule")
  const [pageError, setPageError] = useState("")
  const [loadedDraftTitle, setLoadedDraftTitle] = useState("")
  const [loadedContestTitle, setLoadedContestTitle] = useState("")

  useEffect(()=> {
    const loadEditorState = async () => {
      try {
        if (draftId) {
          const problemsStorageKey = getDraftProblemsStorageKey(draftId)
          const response = await axios.get(`${API_BASE_URL}/contests/drafts/${draftId}/`, {
            withCredentials: true,
          })
          const draft = response.data?.draft
          if (!draft) {
            throw new Error("Draft not found.")
          }

          const startTime = draft.start_time
            ? new Date(draft.start_time).toISOString().slice(0, 16)
            : ""
          const endTime = draft.end_time
            ? new Date(draft.end_time).toISOString().slice(0, 16)
            : ""
          let duration = ""
          if (startTime && endTime) {
            const start = parseSafeUTCDate(draft.start_time);
            const end = parseSafeUTCDate(draft.end_time);
            const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
            duration = Number.isFinite(diffMinutes) && diffMinutes > 0 ? String(diffMinutes) : ""
          }

          setContest({
            title: draft.title || "",
            description: draft.description || "",
            start_time: startTime,
            duration,
            visibility: draft.visibility || "public",
          })
          const savedProblems = localStorage.getItem(problemsStorageKey)
          if (Array.isArray(draft.problems) && draft.problems.length > 0) {
            setProblems(draft.problems)
          } else if (savedProblems) {
            setProblems(JSON.parse(savedProblems))
          }
          setLoadedDraftTitle(draft.title || "Draft")
          return
        }

        if (contestId) {
          const response = await axios.get(`${API_BASE_URL}/contests/${contestId}/edit/`, {
            withCredentials: true,
          })
          const existingContest = response.data?.contest
          if (!existingContest) {
            throw new Error("Contest not found.")
          }

          const startTime = existingContest.start_time
            ? new Date(existingContest.start_time).toISOString().slice(0, 16)
            : ""
          const endTime = existingContest.end_time
            ? new Date(existingContest.end_time).toISOString().slice(0, 16)
            : ""
          let duration = ""
          if (startTime && endTime) {
            const start = new Date(existingContest.start_time)
            const end = new Date(existingContest.end_time)
            const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
            duration = Number.isFinite(diffMinutes) && diffMinutes > 0 ? String(diffMinutes) : ""
          }

          setContest({
            title: existingContest.title || "",
            description: existingContest.description || "",
            start_time: startTime,
            duration,
            visibility: existingContest.visibility || "public",
          })
          setLoadedContestTitle(existingContest.title || "Contest")
          return
        }

        const savedContest = localStorage.getItem(getDraftContestStorageKey())
        const savedProblems = localStorage.getItem(getDraftProblemsStorageKey())

        if (savedContest) {
          setContest(JSON.parse(savedContest))
        }

        if (savedProblems) {
          setProblems(JSON.parse(savedProblems))
        }
      } catch (error) {
        setPageError(
          error.response?.data?.error ||
          error.message ||
          "We could not restore your saved contest draft. Clear the broken draft and try again."
        )
      } finally {
        setPageLoading(false)
      }
    }

    loadEditorState()
  },[contestId, draftId])

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

    if (!isContestEditMode && problems.length === 0) {
      alert("Add at least one problem before creating the contest.")
      return
    }

    const payload = {
      contest: {
        ...contest,
        visibility: draftId ? "public" : contest.visibility,
        start_time: toUtcISOString(contest.start_time),
        end_time: toUtcISOString(calculatedEndTime),
      },
      problems,
    }

    try {
     setSubmitMode("schedule")
     setSubmitLoading(true)
     setPageError("")
     if (isContestEditMode) {
       await axios.put(`${API_BASE_URL}/contests/${contestId}/edit/`, payload.contest, {
         withCredentials: true
       });
       navigate(`/contest/${contestId}/`)
     } else {
       const response = await axios.post(`${API_BASE_URL}/contests/create/`, payload, {
         withCredentials: true
       });
       const createdContestId = response.data?.contest?.contest_id
       localStorage.removeItem(getDraftContestStorageKey())
       localStorage.removeItem(getDraftProblemsStorageKey())
       if (createdContestId) {
         navigate(`/contest/${createdContestId}/problems/edit`)
       } else {
         navigate('/contests')
       }
     }
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

  const handleSaveDraft = async () => {
    const payload = {
      contest: {
        ...contest,
        start_time: contest.start_time ? toUtcISOString(contest.start_time) : null,
        end_time: calculatedEndTime ? toUtcISOString(calculatedEndTime) : null,
      },
      problems,
    }

    try {
      setSubmitMode("draft")
      setSubmitLoading(true)
      setPageError("")
      let savedDraftId = draftId
      if (draftId) {
        const response = await axios.put(`${API_BASE_URL}/contests/drafts/${draftId}/`, payload, {
          withCredentials: true,
        })
        savedDraftId = response.data?.draft?.contest_id || draftId
      } else {
        const response = await axios.post(`${API_BASE_URL}/contests/drafts/create/`, payload, {
          withCredentials: true,
        })
        savedDraftId = response.data?.draft?.contest_id || draftId
      }
      localStorage.setItem(getDraftContestStorageKey(savedDraftId), JSON.stringify(contest))
      localStorage.setItem(getDraftProblemsStorageKey(savedDraftId), JSON.stringify(problems))
      navigate("/drafts")
    } catch (error) {
      setPageError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Draft saving failed."
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  if (pageLoading || submitLoading) {
    return (
      <LoadingPage
        title={submitLoading ? "Scheduling contest" : "Loading contest editor"}
        subtitle={
          submitLoading
            ? isContestEditMode
              ? "Updating contest metadata and saving the latest schedule."
              : submitMode === "draft"
              ? "Saving the current contest metadata as a reusable draft."
              : "Packaging contest metadata, validating the problem set, and sending it to the arena."
            : isContestEditMode
              ? "Loading the current contest metadata into the editor."
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
    <div className={`overlay ${isDarkMode ? 'dark-mode' : ''}`} style={{ background: 'var(--bg-body)' }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="title">{isContestEditMode ? "EDIT CONTEST DETAILS" : "CREATE NEW CONTEST"}</h2>
            {draftId ? <p className="subtitle">Editing draft: {loadedDraftTitle || draftId}</p> : null}
            {isContestEditMode ? <p className="subtitle">Editing contest: {loadedContestTitle || contestId}</p> : null}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <ThemeToggle />
            <button className="close-btn" onClick={() => navigate(isContestEditMode ? `/contest/${contestId}/` : '/contests')}>×</button>
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

            </div>
          </div>

          {!isContestEditMode ? (
          <div className="section">
            <div className="section-header-row">
               <div>
                 <p className="section-title" style={{ margin: 0 }}>INITIAL PROBLEM SET</p>
                 <p className="section-helper-text">
                   Add the required problems here so the contest can be created. After creation, use the Modify Problems page for detailed statement and testcase edits.
                 </p>
               </div>
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

            {problems.length === 0 ? (
              <div className="inline-note">
                Add at least one problem before scheduling the contest.
              </div>
            ) : (
              <div className="inline-note">
                After the contest is created, you will be taken to the Modify Problems page to refine these problems further.
              </div>
            )}
          </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button className="button button-secondary" onClick={()=>navigate(isContestEditMode ? `/contest/${contestId}/` : '/contests')}>Cancel Session</button>
          <div className="footer-actions">
            {!isContestEditMode ? <button className="button button-draft" onClick={handleSaveDraft}>Save as Draft</button> : null}
            <button className="button button-primary" onClick={handleSubmit}>
              {isContestEditMode ? "SAVE CONTEST DETAILS" : "SCHEDULE CONTEST"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContestFormPage
