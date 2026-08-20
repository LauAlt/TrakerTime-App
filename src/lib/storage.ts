import { PROJECT_COLORS, type AppData } from "./types";

const STORAGE_KEY = "hora-clara.data.v1";

export const defaultData: AppData = {
  projects: [],
  entries: [],
  invoices: [],
  activeTimer: undefined,
  settings: {
    freelancerName: "",
    taxLabel: "",
    defaultCurrency: "USD",
  },
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultData;
    }

    const parsed = JSON.parse(raw) as Partial<AppData>;

    const projects = parsed.projects ?? [];

    return {
      ...defaultData,
      ...parsed,
      settings: {
        ...defaultData.settings,
        ...parsed.settings,
      },
      projects: projects.map((project, index) => ({
        ...project,
        color: PROJECT_COLORS.includes(project.color)
          ? project.color
          : PROJECT_COLORS[index % PROJECT_COLORS.length],
      })),
      entries: parsed.entries ?? [],
      invoices: parsed.invoices ?? [],
    };
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportBackup(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hora-clara-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
