function SiteFooter({ className = "" }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`site-footer ${className}`.trim()}>
      <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
        <img src="/app.ico" alt="AlgoArena Logo" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
        Copyright © {year} ALGOARENA. All rights reserved.
      </p>
    </footer>
  );
}

export default SiteFooter;
