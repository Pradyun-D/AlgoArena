import { useState,useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "../Styles/form.css"

const ContestFormPage = () => {
  const navigate = useNavigate();
  const [contest, setContest] = useState({
    title: "",
    description: "",
    start_time: "",
    duration: "",
    visibility: "public"
  })

  const [problem, setProblem] = useState({
    title: "",
    description: "",
    difficulty: "easy",
    time_limit_ms: "",
    memory_limit_kb: "",
    visibility: "public",
    tags: [],
    max_score: ""
  })

  const [tagInput, setTagInput] = useState("")
  const [problems, setProblems] = useState([])

  useEffect(()=> {
    const savedContest=localStorage.getItem("contestDraft")
    const savedProblems=localStorage.getItem("problemDraft")
    if (savedContest) setContest(JSON.parse(savedContest))
    if (savedProblems) setProblems(JSON.parse(savedProblems))
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

  const addProblem = () => {
    setProblems(prev => [...prev, problem])

    setProblem({
      title: "",
      description: "",
      difficulty: "easy",
      time_limit_ms: "",
      memory_limit_kb: "",
      visibility: "public",
      tags: [],
      max_score: ""
    })
  }

  const removeProblem = (i) => {
    setProblems(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async () => {
    await fetch("http://localhost:8000/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contest, problems })
    })
    localStorage.removeItem("contestDraft")
    localStorage.removeItem("problemsDraft")
  }

  const handleSaveDraft = () => {
    localStorage.setItem("contestDraft", JSON.stringify(contest))
    localStorage.setItem("problemsDraft", JSON.stringify(problems))
   
    alert("Draft saved locally!") 
  }

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="title">CREATE NEW CONTEST</h2>
            
          </div>
          <button className="close-btn">×</button>
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
                  <input className="input" placeholder="--:--:--" disabled />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
               <p className="section-title">PROBLEM SELECTION</p>
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

            <div className="row" style={{marginBottom: '16px', alignItems: 'center'}}>
              <input className="input" placeholder="Enter tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <button className="button button-draft" onClick={addTag}>Add Tag</button>
              <button className="button button-primary" onClick={addProblem}>Add Problem</button>
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
                  <button className="button button-secondary" onClick={() => removeProblem(i)}>Remove</button>
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