function SiteFooter({ className = "" }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`site-footer ${className}`.trim()}>
      <p>Copyright © {year} ALGOARENA. All rights reserved.</p>
    </footer>
  );
}

export default SiteFooter;
