import { FormEvent, useEffect, useState } from "react";
import {
  BarChart3,
  Clock3,
  Database,
  Download,
  FileText,
  FolderKanban,
  Pencil,
  Play,
  Plus,
  ReceiptText,
  Save,
  Square,
  TimerReset,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { downloadInvoicePdf } from "./lib/invoice";
import { exportBackup, loadData, saveData } from "./lib/storage";
import {
  CURRENCIES,
  PROJECT_COLORS,
  type AppData,
  type CurrencyCode,
  type Invoice,
  type Project,
  type TimeEntry,
} from "./lib/types";
import { makeId } from "./lib/utils";
import {
  calculateEntryAmount,
  dateInputValue,
  formatDuration,
  formatHours,
  formatMoney,
  formatTimer,
  hoursFromMs,
  summarizeByCurrency,
} from "./lib/time";

type View = "dashboard" | "projects" | "entries" | "invoices";

const navItems: Array<{ id: View; label: string; icon: typeof Clock3 }> = [
  { id: "dashboard", label: "Tracker", icon: Clock3 },
  { id: "projects", label: "Proyectos", icon: FolderKanban },
  { id: "entries", label: "Horas", icon: BarChart3 },
  { id: "invoices", label: "Facturas", icon: ReceiptText },
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sortEntriesNewestFirst(entries: TimeEntry[]) {
  return [...entries].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );
}

function getProject(projects: Project[], projectId: string) {
  return projects.find((project) => project.id === projectId);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<View>("dashboard");
  const [now, setNow] = useState(() => new Date());
  const activeProjects = data.projects.filter((project) => !project.archivedAt);
  const firstProjectId = activeProjects[0]?.id ?? "";
  const [timerProjectId, setTimerProjectId] = useState(firstProjectId);
  const [timerDescription, setTimerDescription] = useState("");
  const [projectForm, setProjectForm] = useState({
    name: "",
    clientName: "",
    hourlyRate: "",
    currency: data.settings.defaultCurrency,
    color: PROJECT_COLORS[0],
  });
  const [manualEntryForm, setManualEntryForm] = useState({
    projectId: firstProjectId,
    date: dateInputValue(),
    hours: "",
    description: "",
    isBillable: true,
  });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    projectId: firstProjectId,
    issueDate: dateInputValue(),
    dueDate: dateInputValue(addDays(new Date(), 15)),
    freelancerName: data.settings.freelancerName,
    taxLabel: data.settings.taxLabel,
    notes: "Gracias por tu trabajo.",
  });
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!timerProjectId && firstProjectId) {
      setTimerProjectId(firstProjectId);
    }

    if (!manualEntryForm.projectId && firstProjectId) {
      setManualEntryForm((current) => ({ ...current, projectId: firstProjectId }));
    }

    if (!invoiceForm.projectId && firstProjectId) {
      setInvoiceForm((current) => ({ ...current, projectId: firstProjectId }));
    }
  }, [firstProjectId, invoiceForm.projectId, manualEntryForm.projectId, timerProjectId]);

  const activeTimerProject = data.activeTimer
    ? getProject(data.projects, data.activeTimer.projectId)
    : undefined;
  const activeElapsedMs = data.activeTimer
    ? now.getTime() - new Date(data.activeTimer.startedAt).getTime()
    : 0;

  const totalTrackedMs = data.entries.reduce((total, entry) => total + entry.durationMs, 0);
  const billableMs = data.entries
    .filter((entry) => entry.isBillable)
    .reduce((total, entry) => total + entry.durationMs, 0);
  const pendingBillableEntries = data.entries.filter(
    (entry) => entry.isBillable && !entry.invoiceId,
  );
  const hasWorkspaceData =
    data.projects.length > 0 ||
    data.entries.length > 0 ||
    data.invoices.length > 0 ||
    Boolean(data.activeTimer);
  const totalsByCurrency = summarizeByCurrency(data.projects, data.entries);
  const recentEntries = sortEntriesNewestFirst(data.entries).slice(0, 5);
  const selectedInvoiceProject = getProject(data.projects, invoiceForm.projectId);
  const invoiceEntries = selectedInvoiceProject
    ? sortEntriesNewestFirst(
        data.entries.filter(
          (entry) =>
            entry.projectId === selectedInvoiceProject.id &&
            entry.isBillable &&
            !entry.invoiceId,
        ),
      )
    : [];
  const selectedInvoiceEntries = invoiceEntries.filter((entry) =>
    selectedEntryIds.includes(entry.id),
  );
  const selectedInvoiceTotal = selectedInvoiceEntries.reduce(
    (total, entry) => total + calculateEntryAmount(entry, selectedInvoiceProject),
    0,
  );

  function updateProjectForm(key: keyof typeof projectForm, value: string) {
    setProjectForm((current) => ({ ...current, [key]: value }));
  }

  function renderProjectForm(submitLabel: string) {
    return (
      <form className="space-y-4" onSubmit={handleCreateProject}>
        <Field label="Cliente">
          <Input
            value={projectForm.clientName}
            placeholder="Ej: Acme Studio"
            onChange={(event) => updateProjectForm("clientName", event.target.value)}
          />
        </Field>
        <Field label="Proyecto">
          <Input
            value={projectForm.name}
            placeholder="Ej: Website institucional"
            onChange={(event) => updateProjectForm("name", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor por hora">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={projectForm.hourlyRate}
              placeholder="45"
              onChange={(event) => updateProjectForm("hourlyRate", event.target.value)}
            />
          </Field>
          <Field label="Moneda">
            <Select
              value={projectForm.currency}
              onChange={(event) => updateProjectForm("currency", event.target.value)}
            >
              {Object.entries(CURRENCIES).map(([code, currency]) => (
                <option key={code} value={code}>
                  {currency.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Elegir color ${color}`}
                className={`size-8 rounded-md border-2 ${
                  projectForm.color === color ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => updateProjectForm("color", color)}
              />
            ))}
          </div>
        </Field>
        <Button className="w-full" type="submit">
          <Plus className="size-4" />
          {submitLabel}
        </Button>
      </form>
    );
  }

  function handleCreateProject(event: FormEvent) {
    event.preventDefault();

    const hourlyRate = Number(projectForm.hourlyRate);

    if (!projectForm.name.trim() || !projectForm.clientName.trim() || hourlyRate <= 0) {
      return;
    }

    const project: Project = {
      id: makeId("project"),
      name: projectForm.name.trim(),
      clientName: projectForm.clientName.trim(),
      hourlyRate,
      currency: projectForm.currency as CurrencyCode,
      color: projectForm.color,
      createdAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      projects: [project, ...current.projects],
      settings: {
        ...current.settings,
        defaultCurrency: project.currency,
      },
    }));
    setTimerProjectId(project.id);
    setManualEntryForm((current) => ({ ...current, projectId: project.id }));
    setInvoiceForm((current) => ({ ...current, projectId: project.id }));
    setSelectedEntryIds([]);
    setProjectForm({
      name: "",
      clientName: "",
      hourlyRate: "",
      currency: project.currency,
      color: projectForm.color,
    });
  }

  function handleStartTimer() {
    const projectId = timerProjectId || firstProjectId;

    if (!projectId || data.activeTimer) {
      return;
    }

    setData((current) => ({
      ...current,
      activeTimer: {
        projectId,
        description: timerDescription.trim(),
        startedAt: new Date().toISOString(),
      },
    }));
  }

  function handleStopTimer() {
    if (!data.activeTimer) {
      return;
    }

    const endAt = new Date();
    const startAt = new Date(data.activeTimer.startedAt);
    const durationMs = Math.max(1000, endAt.getTime() - startAt.getTime());
    const entry: TimeEntry = {
      id: makeId("entry"),
      projectId: data.activeTimer.projectId,
      description: data.activeTimer.description || timerDescription.trim(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      durationMs,
      isBillable: true,
    };

    setData((current) => ({
      ...current,
      activeTimer: undefined,
      entries: [entry, ...current.entries],
    }));
    setTimerDescription("");
  }

  function handleDiscardTimer() {
    setData((current) => ({ ...current, activeTimer: undefined }));
    setTimerDescription("");
  }

  function handleCreateManualEntry(event: FormEvent) {
    event.preventDefault();

    const projectId = manualEntryForm.projectId || firstProjectId;
    const hours = Number(manualEntryForm.hours);

    if (!projectId || hours <= 0) {
      return;
    }

    const startAt = new Date(`${manualEntryForm.date}T09:00:00`);
    const durationMs = Math.round(hours * 3_600_000);
    const endAt = new Date(startAt.getTime() + durationMs);

    if (editingEntryId) {
      setData((current) => ({
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === editingEntryId && !entry.invoiceId
            ? {
                ...entry,
                projectId,
                description: manualEntryForm.description.trim(),
                startAt: startAt.toISOString(),
                endAt: endAt.toISOString(),
                durationMs,
                isBillable: manualEntryForm.isBillable,
              }
            : entry,
        ),
      }));
      resetManualEntryForm(projectId);
      return;
    }

    const entry: TimeEntry = {
      id: makeId("entry"),
      projectId,
      description: manualEntryForm.description.trim(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      durationMs,
      isBillable: manualEntryForm.isBillable,
    };

    setData((current) => ({
      ...current,
      entries: [entry, ...current.entries],
    }));
    resetManualEntryForm(projectId);
  }

  function resetManualEntryForm(projectId = manualEntryForm.projectId || firstProjectId) {
    setManualEntryForm((current) => ({
      ...current,
      projectId,
      date: dateInputValue(),
      hours: "",
      description: "",
      isBillable: true,
    }));
    setEditingEntryId(null);
  }

  function handleEditEntry(entry: TimeEntry) {
    if (entry.invoiceId) {
      return;
    }

    setEditingEntryId(entry.id);
    setManualEntryForm({
      projectId: entry.projectId,
      date: dateInputValue(new Date(entry.startAt)),
      hours: hoursFromMs(entry.durationMs).toFixed(2),
      description: entry.description,
      isBillable: entry.isBillable,
    });
    setView("entries");
  }

  function handleDeleteEntry(entryId: string) {
    setData((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== entryId || entry.invoiceId),
    }));
    if (editingEntryId === entryId) {
      resetManualEntryForm();
    }
  }

  function selectInvoiceProject(projectId: string) {
    setInvoiceForm((current) => ({ ...current, projectId }));
    const selectableIds = data.entries
      .filter((entry) => entry.projectId === projectId && entry.isBillable && !entry.invoiceId)
      .map((entry) => entry.id);
    setSelectedEntryIds(selectableIds);
  }

  function toggleInvoiceEntry(entryId: string) {
    setSelectedEntryIds((current) =>
      current.includes(entryId)
        ? current.filter((selectedId) => selectedId !== entryId)
        : [...current, entryId],
    );
  }

  function handleCreateInvoice() {
    if (!selectedInvoiceProject || selectedInvoiceEntries.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();
    const invoice: Invoice = {
      id: makeId("invoice"),
      number: `FAC-${new Date().getFullYear()}-${String(data.invoices.length + 1).padStart(
        4,
        "0",
      )}`,
      projectId: selectedInvoiceProject.id,
      clientName: selectedInvoiceProject.clientName,
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate,
      freelancerName: invoiceForm.freelancerName.trim(),
      taxLabel: invoiceForm.taxLabel.trim(),
      notes: invoiceForm.notes.trim(),
      currency: selectedInvoiceProject.currency,
      subtotal: selectedInvoiceTotal,
      totalHours: selectedInvoiceEntries.reduce(
        (total, entry) => total + hoursFromMs(entry.durationMs),
        0,
      ),
      entryIds: selectedInvoiceEntries.map((entry) => entry.id),
      createdAt,
    };

    setData((current) => ({
      ...current,
      invoices: [invoice, ...current.invoices],
      entries: current.entries.map((entry) =>
        invoice.entryIds.includes(entry.id)
          ? { ...entry, invoiceId: invoice.id, invoicedAt: createdAt }
          : entry,
      ),
      settings: {
        ...current.settings,
        freelancerName: invoice.freelancerName,
        taxLabel: invoice.taxLabel,
      },
    }));
    setSelectedEntryIds([]);
    downloadInvoicePdf(invoice, selectedInvoiceProject, selectedInvoiceEntries);
  }

  function handleDownloadExistingInvoice(invoice: Invoice) {
    const project = getProject(data.projects, invoice.projectId);
    const entries = data.entries.filter((entry) => invoice.entryIds.includes(entry.id));

    if (!project) {
      return;
    }

    downloadInvoicePdf(invoice, project, entries);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.08),transparent_34rem),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,247,241,0.94))]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Clock3 className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Hora Clara</h1>
              <p className="text-sm text-muted-foreground">
                Tiempo, tarifas y facturas para freelancers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={view === item.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView(item.id)}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </header>

        {hasWorkspaceData && (
          <section className="grid gap-4 py-5 metric-grid">
            <MetricCard
              icon={Clock3}
              label="Horas registradas"
              value={`${formatHours(totalTrackedMs)} h`}
            />
            <MetricCard icon={Wallet} label="Horas facturables" value={`${formatHours(billableMs)} h`} />
            <MetricCard
              icon={FileText}
              label="Pendientes de factura"
              value={String(pendingBillableEntries.length)}
            />
            <MetricCard icon={FolderKanban} label="Proyectos activos" value={String(activeProjects.length)} />
          </section>
        )}

        {view === "dashboard" && (
          !hasWorkspaceData ? (
            <section className="grid flex-1 items-start gap-5 py-5 lg:grid-cols-[0.95fr_1.05fr]">
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-card/80">
                  <Badge className="mb-2 w-fit" variant="secondary">
                    Primer setup
                  </Badge>
                  <CardTitle className="text-2xl">Crea tu primer proyecto</CardTitle>
                  <CardDescription>
                    Cliente, tarifa y moneda quedan listos para iniciar el tracker.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">{renderProjectForm("Crear proyecto")}</CardContent>
              </Card>

              <div className="grid gap-5">
                <Card className="overflow-hidden">
                  <CardHeader className="border-b bg-card/80">
                    <CardTitle>Vista de trabajo</CardTitle>
                    <CardDescription>Asi se vera tu espacio cuando empieces a registrar horas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5">
                    <div className="rounded-lg border bg-muted/30 p-5">
                      <p className="text-sm text-muted-foreground">Sesion activa</p>
                      <div className="mt-2 font-mono text-5xl font-semibold tracking-normal">
                        01:24:18
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Acme Studio</p>
                          <p className="text-sm text-muted-foreground">Website institucional</p>
                        </div>
                        <Badge variant="amber">USD 45/h</Badge>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniPreview label="Hoy" value="1,40 h" />
                      <MiniPreview label="Facturable" value="US$ 63" />
                      <MiniPreview label="Factura" value="PDF" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Factura minimalista</CardTitle>
                    <CardDescription>Los registros facturables se agrupan por proyecto y moneda.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
                      <div className="flex items-start justify-between border-b pb-3">
                        <div>
                          <p className="text-lg font-semibold">Factura</p>
                          <p className="text-muted-foreground">FAC-2026-0001</p>
                        </div>
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="grid gap-3 py-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Cliente</p>
                          <p className="font-medium">Acme Studio</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Proyecto</p>
                          <p className="font-medium">Website institucional</p>
                        </div>
                      </div>
                      <div className="space-y-2 border-t pt-3">
                        <div className="flex justify-between">
                          <span>Diseno y ajustes</span>
                          <span>2,50 h</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>US$ 112,50</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          ) : (
          <section className="grid flex-1 gap-5 py-5 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-card/80">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Tracker en vivo</CardTitle>
                    <CardDescription>
                      Inicia una sesion, cambia de proyecto al terminar y conserva todo localmente.
                    </CardDescription>
                  </div>
                  {data.activeTimer ? (
                    <Badge variant="amber">Activo</Badge>
                  ) : (
                    <Badge variant="secondary">Listo</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-5">
                <div className="rounded-lg border bg-muted/30 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {data.activeTimer && activeTimerProject
                          ? `${activeTimerProject.clientName} / ${activeTimerProject.name}`
                          : "Sin sesion activa"}
                      </p>
                      <div className="mt-2 font-mono text-5xl font-semibold tracking-normal sm:text-6xl">
                        {formatTimer(activeElapsedMs)}
                      </div>
                    </div>
                    {activeTimerProject && (
                      <div
                        className="h-3 w-24 rounded-full"
                        style={{ backgroundColor: activeTimerProject.color }}
                      />
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Proyecto">
                    <Select
                      value={timerProjectId}
                      disabled={Boolean(data.activeTimer)}
                      onChange={(event) => setTimerProjectId(event.target.value)}
                    >
                      <option value="">Seleccionar proyecto</option>
                      {activeProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.clientName} - {project.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Detalle opcional">
                    <Input
                      value={timerDescription}
                      disabled={Boolean(data.activeTimer)}
                      placeholder="Ej: Ajustes de checkout"
                      onChange={(event) => setTimerDescription(event.target.value)}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={Boolean(data.activeTimer) || !activeProjects.length}
                    onClick={handleStartTimer}
                  >
                    <Play className="size-4" />
                    Iniciar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!data.activeTimer}
                    onClick={handleStopTimer}
                  >
                    <Square className="size-4" />
                    Detener y guardar
                  </Button>
                  <Button variant="ghost" disabled={!data.activeTimer} onClick={handleDiscardTimer}>
                    <TimerReset className="size-4" />
                    Descartar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen por moneda</CardTitle>
                  <CardDescription>Los importes se calculan con la tarifa de cada proyecto.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {totalsByCurrency.length ? (
                    totalsByCurrency.map((total) => (
                      <div
                        key={total.currency}
                        className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{total.currency}</p>
                          <p className="text-xs text-muted-foreground">
                            {total.hours.toFixed(2)} horas
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {formatMoney(total.amount, total.currency)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="Todavia no hay horas registradas." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Datos</CardTitle>
                  <CardDescription>
                    Guardado automatico en este navegador mediante localStorage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" onClick={() => exportBackup(data)}>
                    <Database className="size-4" />
                    Exportar backup JSON
                  </Button>
                  <Button variant="outline" onClick={() => setView("projects")}>
                    <Plus className="size-4" />
                    Crear proyecto
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
          )
        )}

        {view === "projects" && (
          <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <Card>
              <CardHeader>
                <CardTitle>Nuevo proyecto</CardTitle>
                <CardDescription>Define cliente, tarifa por hora y moneda.</CardDescription>
              </CardHeader>
              <CardContent>{renderProjectForm("Guardar proyecto")}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proyectos activos</CardTitle>
                <CardDescription>Base para el tracker y las facturas.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {activeProjects.length ? (
                  activeProjects.map((project) => {
                    const projectEntries = data.entries.filter(
                      (entry) => entry.projectId === project.id,
                    );
                    const projectMs = projectEntries.reduce(
                      (total, entry) => total + entry.durationMs,
                      0,
                    );
                    const projectRevenue = projectEntries.reduce(
                      (total, entry) => total + calculateEntryAmount(entry, project),
                      0,
                    );

                    return (
                      <div key={project.id} className="rounded-lg border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">{project.clientName}</p>
                            <h3 className="mt-1 font-semibold">{project.name}</h3>
                          </div>
                          <div
                            className="mt-1 h-3 w-12 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-md bg-muted/60 p-2">
                            <p className="text-xs text-muted-foreground">Tarifa</p>
                            <p className="font-semibold">
                              {formatMoney(project.hourlyRate, project.currency)}/h
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/60 p-2">
                            <p className="text-xs text-muted-foreground">Registrado</p>
                            <p className="font-semibold">{formatHours(projectMs)} h</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm font-medium">
                          {formatMoney(projectRevenue, project.currency)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="md:col-span-2">
                    <EmptyState text="Crea tu primer proyecto para empezar a trackear." />
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {view === "entries" && (
          <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <Card>
              <CardHeader>
                <CardTitle>{editingEntryId ? "Editar horas" : "Carga manual"}</CardTitle>
                <CardDescription>
                  {editingEntryId
                    ? "Actualiza proyecto, fecha, tiempo, detalle o estado facturable."
                    : "Para horas que olvidaste iniciar en vivo."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleCreateManualEntry}>
                  <Field label="Proyecto">
                    <Select
                      value={manualEntryForm.projectId}
                      onChange={(event) =>
                        setManualEntryForm((current) => ({
                          ...current,
                          projectId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccionar proyecto</option>
                      {activeProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.clientName} - {project.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Fecha">
                      <Input
                        type="date"
                        value={manualEntryForm.date}
                        onChange={(event) =>
                          setManualEntryForm((current) => ({
                            ...current,
                            date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Horas">
                      <Input
                        type="number"
                        min="0"
                        step="0.25"
                        value={manualEntryForm.hours}
                        placeholder="2.5"
                        onChange={(event) =>
                          setManualEntryForm((current) => ({
                            ...current,
                            hours: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Detalle">
                    <Textarea
                      value={manualEntryForm.description}
                      placeholder="Ej: Revision final y ajustes"
                      onChange={(event) =>
                        setManualEntryForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={manualEntryForm.isBillable}
                      onChange={(event) =>
                        setManualEntryForm((current) => ({
                          ...current,
                          isBillable: event.target.checked,
                        }))
                      }
                    />
                    Facturable
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1" type="submit">
                      {editingEntryId ? <Save className="size-4" /> : <Plus className="size-4" />}
                      {editingEntryId ? "Guardar cambios" : "Agregar horas"}
                    </Button>
                    {editingEntryId && (
                      <Button
                        className="flex-1"
                        type="button"
                        variant="outline"
                        onClick={() => resetManualEntryForm()}
                      >
                        <X className="size-4" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registro de horas</CardTitle>
                <CardDescription>Las horas facturadas quedan bloqueadas para conservar trazabilidad.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortEntriesNewestFirst(data.entries).length ? (
                  sortEntriesNewestFirst(data.entries).map((entry) => {
                    const project = getProject(data.projects, entry.projectId);
                    const amount = calculateEntryAmount(entry, project);

                    return (
                      <div
                        key={entry.id}
                        className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={entry.invoiceId ? "secondary" : "outline"}>
                              {entry.invoiceId ? "Facturado" : entry.isBillable ? "Facturable" : "No facturable"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {shortDate(entry.startAt)}
                            </span>
                          </div>
                          <p className="mt-2 font-medium">
                            {project ? `${project.clientName} / ${project.name}` : "Proyecto eliminado"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {entry.description || "Sin detalle"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div className="text-right">
                            <p className="font-semibold">{formatDuration(entry.durationMs)}</p>
                            {project && (
                              <p className="text-sm text-muted-foreground">
                                {formatMoney(amount, project.currency)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant={editingEntryId === entry.id ? "secondary" : "ghost"}
                              size="icon"
                              disabled={Boolean(entry.invoiceId)}
                              title={
                                entry.invoiceId
                                  ? "No se puede editar una hora facturada"
                                  : "Editar registro"
                              }
                              onClick={() => handleEditEntry(entry)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={Boolean(entry.invoiceId)}
                              title={
                                entry.invoiceId
                                  ? "No se puede borrar una hora facturada"
                                  : "Borrar registro"
                              }
                              onClick={() => handleDeleteEntry(entry.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState text="No hay horas cargadas todavia." />
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {view === "invoices" && (
          <section className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>Nueva factura PDF</CardTitle>
                <CardDescription>
                  Selecciona horas pendientes y descarga una factura minimalista.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre emisor">
                    <Input
                      value={invoiceForm.freelancerName}
                      placeholder="Tu nombre o marca"
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          freelancerName: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Identificacion fiscal">
                    <Input
                      value={invoiceForm.taxLabel}
                      placeholder="CUIT, RUT, RFC, NIT..."
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          taxLabel: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Proyecto">
                    <Select
                      value={invoiceForm.projectId}
                      onChange={(event) => selectInvoiceProject(event.target.value)}
                    >
                      <option value="">Seleccionar proyecto</option>
                      {activeProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.clientName} - {project.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Fecha">
                    <Input
                      type="date"
                      value={invoiceForm.issueDate}
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          issueDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Vencimiento">
                    <Input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(event) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Notas">
                  <Textarea
                    value={invoiceForm.notes}
                    onChange={(event) =>
                      setInvoiceForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </Field>

                <div className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
                    <p className="text-sm font-medium">Horas pendientes</p>
                    {selectedInvoiceProject && (
                      <p className="text-sm text-muted-foreground">
                        {formatMoney(selectedInvoiceTotal, selectedInvoiceProject.currency)}
                      </p>
                    )}
                  </div>
                  <div className="max-h-80 overflow-auto p-2">
                    {invoiceEntries.length ? (
                      invoiceEntries.map((entry) => {
                        const checked = selectedEntryIds.includes(entry.id);
                        const amount = calculateEntryAmount(entry, selectedInvoiceProject);

                        return (
                          <label
                            key={entry.id}
                            className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                          >
                            <input
                              type="checkbox"
                              className="size-4 rounded border-input"
                              checked={checked}
                              onChange={() => toggleInvoiceEntry(entry.id)}
                            />
                            <span>
                              <span className="block text-sm font-medium">
                                {entry.description || "Trabajo por hora"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {shortDate(entry.startAt)} / {formatDuration(entry.durationMs)}
                              </span>
                            </span>
                            {selectedInvoiceProject && (
                              <span className="text-sm font-semibold">
                                {formatMoney(amount, selectedInvoiceProject.currency)}
                              </span>
                            )}
                          </label>
                        );
                      })
                    ) : (
                      <EmptyState text="No hay horas facturables pendientes para este proyecto." />
                    )}
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedInvoiceProject || selectedInvoiceEntries.length === 0}
                  onClick={handleCreateInvoice}
                >
                  <Download className="size-4" />
                  Generar y descargar PDF
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Facturas generadas</CardTitle>
                <CardDescription>Se guardan los metadatos y se puede regenerar el PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.invoices.length ? (
                  data.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
                    >
                      <div>
                        <p className="font-medium">{invoice.number}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.clientName} / {invoice.totalHours.toFixed(2)} h
                        </p>
                        <p className="text-sm font-semibold">
                          {formatMoney(invoice.subtotal, invoice.currency)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Descargar PDF"
                        onClick={() => handleDownloadExistingInvoice(invoice)}
                      >
                        <Download className="size-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <EmptyState text="Todavia no hay facturas generadas." />
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-normal">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export default App;
