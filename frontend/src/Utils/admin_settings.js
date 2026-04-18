export const ADMIN_SETTINGS_KEY = "algoarena-admin-settings";

export const defaultAdminSettings = {
  deleteConfirm: true,
  compactTables: false,
  landingPage: "dashboard",
};

export const getAdminLandingPath = (landingPage = defaultAdminSettings.landingPage) => {
  switch (landingPage) {
    case "permissions":
      return "/admin/permissions";
    case "drafts":
      return "/drafts";
    case "dashboard":
    default:
      return "/admin/dashboard";
  }
};

export const getAdminSettings = () => {
  try {
    const stored = window.localStorage.getItem(ADMIN_SETTINGS_KEY);
    return stored
      ? { ...defaultAdminSettings, ...JSON.parse(stored) }
      : defaultAdminSettings;
  } catch {
    return defaultAdminSettings;
  }
};

export const saveAdminSettings = (settings) => {
  window.localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
};
