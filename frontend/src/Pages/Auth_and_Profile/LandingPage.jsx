import { Link } from "react-router-dom";
import "../../Styles/landing_page.css";
import ThemeToggle from "../../Components/ThemeToggle";

const featureItems = [
  {
    label: "Fast Judging",
    value: "< 120ms",
    description: "Low-latency verdicts for the rounds that matter.",
  },
  {
    label: "Live Arena",
    value: "24/7",
    description: "Contests, practice runs, and ranked sessions in one flow.",
  },
  {
    label: "Secure Runs",
    value: "Isolated",
    description: "Sandboxed execution with clean resource boundaries.",
  },
];

function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-noise" aria-hidden="true" />
      <div className="landing-stars" aria-hidden="true">
        <span className="star star-a" />
        <span className="star star-b" />
        <span className="star star-c" />
        <span className="star star-d" />
        <span className="star star-e" />
        <span className="star star-f" />
      </div>

      <header className="landing-header">
        <Link to="/" className="landing-brand">
          Algo Arena
        </Link>

        <nav className="landing-nav" aria-label="Primary">
          <a href="#features">Features</a>
        
        </nav>

        <div className="landing-actions">
          <ThemeToggle className="landing-theme-toggle" />
          <Link to="/login" className="landing-link-button">
            Log In
          </Link>
          <Link to="/register" className="landing-primary-button">
            Register
          </Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="hero-status">
              <span className="hero-status-dot" />
              <span>Deep Space Arena Online</span>
            </div>

            <p className="hero-kicker">Competitive coding, reframed as a launch sequence.</p>
            <h1 className="hero-title">
              Enter a coding arena
              <br />
              built like a starfield.
            </h1>
            <p className="hero-description">
              Run contests, climb live leaderboards, and push submissions through a cleaner,
              faster interface with a cinematic space backdrop.
            </p>

            <div className="hero-buttons">
              <Link to="/contests" className="landing-primary-button">
                Enter Arena
              </Link>
              <Link to="/register" className="landing-secondary-button">
                Create Account
              </Link>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="orbital-ring ring-one" />
            <div className="orbital-ring ring-two" />
            <div className="orbital-ring ring-three" />
            <div className="hero-planet">
              <div className="hero-core" />
              <div className="hero-glow" />
            </div>
            <div className="signal-card signal-card-top">
              <span className="signal-label">Contest Pulse</span>
              <span className="signal-value">LIVE FEED</span>
            </div>
            <div className="signal-card signal-card-bottom">
              <span className="signal-label">Sandbox</span>
              <span className="signal-value">STABLE ORBIT</span>
            </div>
          </div>
        </section>

        <section className="feature-strip" id="features">
          {featureItems.map((item) => (
            <article className="feature-card" key={item.label}>
              <p className="feature-label">{item.label}</p>
              <p className="feature-value">{item.value}</p>
              <p className="feature-description">{item.description}</p>
            </article>
          ))}
        </section>

      
      </main>
    </div>
  );
}

export default LandingPage;
