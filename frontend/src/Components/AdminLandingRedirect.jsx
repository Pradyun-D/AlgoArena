import { Navigate } from "react-router-dom";
import { getAdminLandingPath, getAdminSettings } from "../Utils/admin_settings";

function AdminLandingRedirect() {
  const targetPath = getAdminLandingPath(getAdminSettings().landingPage);
  return <Navigate to={targetPath} replace />;
}

export default AdminLandingRedirect;
