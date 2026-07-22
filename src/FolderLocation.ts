const getFileLocationPrefix = () => {
  try {
    const saved = localStorage.getItem("settings_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const found = parsed.find((r: any) => r.Title === "File Location");
        if (found && found.Content) {
          return found.Content.trim();
        }
      }
    }
  } catch (e) {}
  return "Main Folder";
};

export const FOLDER_LOCATIONS = {
  get LOGO() {
    return `${getFileLocationPrefix()}/Logo`;
  },
  get EMPLOYEES_PHOTO() {
    return `${getFileLocationPrefix()}/Employees Photo`;
  },
  get BANNER() {
    return `${getFileLocationPrefix()}/Banner`;
  },
  get DOCUMENTS() {
    return `${getFileLocationPrefix()}/Documents`;
  }
};

