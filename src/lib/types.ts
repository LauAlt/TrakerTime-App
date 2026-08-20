export type CurrencyCode =
  | "USD"
  | "ARS"
  | "BRL"
  | "CLP"
  | "COP"
  | "MXN"
  | "PEN"
  | "UYU"
  | "PYG"
  | "BOB";

export type Project = {
  id: string;
  name: string;
  clientName: string;
  hourlyRate: number;
  currency: CurrencyCode;
  color: string;
  createdAt: string;
  archivedAt?: string;
};

export type TimeEntry = {
  id: string;
  projectId: string;
  description: string;
  startAt: string;
  endAt: string;
  durationMs: number;
  isBillable: boolean;
  invoiceId?: string;
  invoicedAt?: string;
};

export type TimerSession = {
  projectId: string;
  description: string;
  startedAt: string;
};

export type Invoice = {
  id: string;
  number: string;
  projectId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  freelancerName: string;
  taxLabel: string;
  notes: string;
  currency: CurrencyCode;
  subtotal: number;
  totalHours: number;
  entryIds: string[];
  createdAt: string;
};

export type AppSettings = {
  freelancerName: string;
  taxLabel: string;
  defaultCurrency: CurrencyCode;
};

export type AppData = {
  projects: Project[];
  entries: TimeEntry[];
  invoices: Invoice[];
  activeTimer?: TimerSession;
  settings: AppSettings;
};

export const CURRENCIES: Record<
  CurrencyCode,
  { label: string; symbol: string; locale: string }
> = {
  USD: { label: "USD - Dolar estadounidense", symbol: "US$", locale: "en-US" },
  ARS: { label: "ARS - Peso argentino", symbol: "$", locale: "es-AR" },
  BRL: { label: "BRL - Real brasileno", symbol: "R$", locale: "pt-BR" },
  CLP: { label: "CLP - Peso chileno", symbol: "$", locale: "es-CL" },
  COP: { label: "COP - Peso colombiano", symbol: "$", locale: "es-CO" },
  MXN: { label: "MXN - Peso mexicano", symbol: "$", locale: "es-MX" },
  PEN: { label: "PEN - Sol peruano", symbol: "S/", locale: "es-PE" },
  UYU: { label: "UYU - Peso uruguayo", symbol: "$U", locale: "es-UY" },
  PYG: { label: "PYG - Guarani paraguayo", symbol: "Gs.", locale: "es-PY" },
  BOB: { label: "BOB - Boliviano", symbol: "Bs.", locale: "es-BO" },
};

export const PROJECT_COLORS = [
  "#FEF9DB",
  "#F2913D",
  "#0CA8BA",
  "#9EC17C",
  "#1F201E",
];
