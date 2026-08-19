import type { CurrencyCode, Project, TimeEntry } from "./types";
import { CURRENCIES } from "./types";

export function formatTimer(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

export function hoursFromMs(ms: number) {
  return ms / 3_600_000;
}

export function formatHours(ms: number) {
  return hoursFromMs(ms).toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoney(amount: number, currency: CurrencyCode) {
  const currencyInfo = CURRENCIES[currency];

  return new Intl.NumberFormat(currencyInfo.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PYG" || currency === "CLP" ? 0 : 2,
  }).format(amount);
}

export function calculateEntryAmount(entry: TimeEntry, project?: Project) {
  if (!project || !entry.isBillable) {
    return 0;
  }

  return hoursFromMs(entry.durationMs) * project.hourlyRate;
}

export function summarizeByCurrency(projects: Project[], entries: TimeEntry[]) {
  const totals = new Map<CurrencyCode, { hours: number; amount: number }>();

  for (const entry of entries) {
    const project = projects.find((item) => item.id === entry.projectId);

    if (!project) {
      continue;
    }

    const current = totals.get(project.currency) ?? { hours: 0, amount: 0 };
    current.hours += hoursFromMs(entry.durationMs);
    current.amount += calculateEntryAmount(entry, project);
    totals.set(project.currency, current);
  }

  return Array.from(totals.entries()).map(([currency, total]) => ({
    currency,
    ...total,
  }));
}

export function dateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
