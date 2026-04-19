import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import axios from "axios";
import { API_BASE_URL } from "../Utils/api";
import { clearStoredAuthUser } from "../Utils/auth_storage";

const baseNavLinkClass = "text-gray-500 hover:text-gray-300 transition-colors font-headline tracking-tight font-bold uppercase text-sm";
const activeNavLinkClass = "text-primary border-b-2 border-[#84adff] pb-1 font-headline tracking-tight font-bold uppercase text-sm";

function ArenaNavbar({
  navLinks = [],
  authUser = null,
  rightContent = null,
  showProfileLink = true,
  showAuthActions = true,
  className = "",
}) {
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/accounts/api/logout/`, {}, { withCredentials: true });
    } catch { 
      // proceed to clear locally even if api fails
    } finally {
      clearStoredAuthUser();
      window.location.href = "/";
    }
  };

  return (
    <nav className={`nav-shell fixed top-0 left-0 right-0 z-50 flex justify-between items-center w-full px-6 h-16 border-none ${className}`.trim()}>
      <div className="flex items-center gap-8">
        <Link className="text-2xl font-black tracking-tighter text-primary font-headline uppercase" to="/contests">
          AlgoArena
        </Link>
        <div className="hidden md:flex gap-6 h-full items-center">
          {navLinks.map((link) => (
            <Link
              key={`${link.label}-${link.to}`}
              className={link.active ? activeNavLinkClass : baseNavLinkClass}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        {rightContent}
        {showAuthActions ? (
          authUser ? (
            <>
              {showProfileLink ? (
                <Link className={baseNavLinkClass} to="/profile/edit" state={{ returnTo: location.pathname }}>
                  Profile
                </Link>
              ) : null}
              <button
                className="p-2 transition-all rounded-sm scale-95 active:opacity-80"
                style={{
                  color: "#03111c",
                  background: "linear-gradient(135deg, #84adff 0%, #4f8eff 48%, #69f0a7 100%)",
                  boxShadow: "0 12px 24px rgba(32, 112, 255, 0.22)",
                  border: "1px solid rgba(132, 173, 255, 0.28)",
                }}
                onClick={handleLogout}
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </>
          ) : (
            <>
              <Link className={baseNavLinkClass} to="/login">
                Login
              </Link>
              <Link className="text-primary border border-outline-variant/20 px-3 py-2 transition-colors font-headline tracking-tight font-bold uppercase text-sm" to="/register">
                Register
              </Link>
            </>
          )
        ) : null}
      </div>
    </nav>
  );
}

export default ArenaNavbar;
