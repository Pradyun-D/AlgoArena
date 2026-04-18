import "../../Styles/loading_page.css";

function LoadingPage({
  title = "Preparing contest arena",
  subtitle = "Fetching problems, syncing submissions, and warming up the live scoreboard.",
}) {
  return (
    <div className="contest-loader-page">
      <div className="contest-loader-grid" aria-hidden="true" />
      <div className="contest-loader-shell">
        <div className="contest-loader-terminal">
          <div className="contest-loader-terminal-bar">
            <span className="loader-dot loader-dot-red" />
            <span className="loader-dot loader-dot-yellow" />
            <span className="loader-dot loader-dot-green" />
            <span className="contest-loader-terminal-label">loading.....</span>
          </div>

          <div className="contest-loader-terminal-body">
            <div className="loader-status-row">
              <span className="loader-status-badge">CP Arena</span>
              <span className="loader-ping">
                <span className="loader-ping-dot" />
                Live sync
              </span>
            </div>

            <h1 className="contest-loader-title">{title}</h1>
            <p className="contest-loader-subtitle">{subtitle}</p>

            <div className="contest-loader-progress">
              <div className="contest-loader-progress-bar" />
            </div>

   
          </div>
        </div>

        <div className="contest-loader-orbit" aria-hidden="true">
          <div className="loader-ring loader-ring-one" />
          <div className="loader-ring loader-ring-two" />
          <div className="loader-ring loader-ring-three" />
          <div className="loader-core">
            <div className="loader-core-inner" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadingPage;
