import { motion } from "motion/react";
import "../../Styles/loading_page.css";

function LoadingPage({
  title = "Preparing contest arena",
  subtitle = "Fetching problems, syncing submissions, and warming up the live scoreboard.",
}) {
  return (
    <div className="contest-loader-page">
      <div className="contest-loader-grid" aria-hidden="true" />

      <div className="contest-loader-shell">
   
        <motion.div
          className="contest-loader-terminal"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="contest-loader-terminal-bar">
            <span className="loader-dot loader-dot-red" />
            <span className="loader-dot loader-dot-yellow" />
            <span className="loader-dot loader-dot-green" />
            <span className="contest-loader-terminal-label">loading.....</span>
          </div>

          <div className="contest-loader-terminal-body">
        
            <motion.div
              className="loader-status-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
            >
              <span className="loader-status-badge">CP Arena</span>
              <span className="loader-ping">
                <span className="loader-ping-dot" />
                Live sync
              </span>
            </motion.div>

      
            <motion.h1
              className="contest-loader-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
            >
              {title}
            </motion.h1>

   
            <motion.p
              className="contest-loader-subtitle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.44, duration: 0.4 }}
            >
              {subtitle}
            </motion.p>

           
            <motion.div
              className="contest-loader-progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.3 }}
            >
              <div className="contest-loader-progress-bar" />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="contest-loader-orbit"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.88, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="loader-ring loader-ring-one" />
          <div className="loader-ring loader-ring-two" />
          <div className="loader-ring loader-ring-three" />

      
          <motion.div
            className="loader-core"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.55, ease: [0.34, 1.26, 0.64, 1] }}
          >
            <div className="loader-core-inner" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default LoadingPage;
