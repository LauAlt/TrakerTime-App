import { jsPDF } from "jspdf";
import type { Invoice, Project, TimeEntry } from "./types";
import {
  calculateEntryAmount,
  formatDuration,
  formatMoney,
  hoursFromMs,
} from "./time";

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function downloadInvoicePdf(
  invoice: Invoice,
  project: Project,
  entries: TimeEntry[],
) {
  const doc = new jsPDF();
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Factura", margin, 21);
  doc.setFontSize(11);
  doc.text(invoice.number, pageWidth - margin, 21, { align: "right" });

  y = 48;
  doc.setTextColor(20, 24, 34);
  doc.setFontSize(10);
  doc.text("Emisor", margin, y);
  doc.setFontSize(13);
  doc.text(invoice.freelancerName || "Freelancer", margin, y + 8);
  doc.setFontSize(10);

  if (invoice.taxLabel) {
    doc.text(invoice.taxLabel, margin, y + 15);
  }

  doc.setFontSize(10);
  doc.text("Cliente", pageWidth / 2, y);
  doc.setFontSize(13);
  doc.text(invoice.clientName, pageWidth / 2, y + 8);
  doc.setFontSize(10);
  doc.text(project.name, pageWidth / 2, y + 15);

  y += 34;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);

  y += 14;
  doc.setFontSize(10);
  doc.text(`Fecha: ${shortDate(invoice.issueDate)}`, margin, y);
  doc.text(`Vencimiento: ${shortDate(invoice.dueDate)}`, pageWidth / 2, y);

  y += 18;
  doc.setFillColor(244, 246, 248);
  doc.rect(margin, y - 8, pageWidth - margin * 2, 10, "F");
  doc.setFontSize(9);
  doc.text("Fecha", margin + 3, y - 1);
  doc.text("Detalle", margin + 31, y - 1);
  doc.text("Tiempo", pageWidth - 64, y - 1, { align: "right" });
  doc.text("Importe", pageWidth - margin - 3, y - 1, { align: "right" });

  y += 10;
  doc.setFontSize(9);
  entries.forEach((entry) => {
    if (y > 265) {
      doc.addPage();
      y = 22;
    }

    const amount = calculateEntryAmount(entry, project);
    const description = entry.description || "Trabajo por hora";
    doc.text(shortDate(entry.startAt), margin + 3, y);
    doc.text(doc.splitTextToSize(description, 72), margin + 31, y);
    doc.text(formatDuration(entry.durationMs), pageWidth - 64, y, {
      align: "right",
    });
    doc.text(formatMoney(amount, project.currency), pageWidth - margin - 3, y, {
      align: "right",
    });
    y += 11;
  });

  y += 7;
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;
  doc.setFontSize(10);
  doc.text("Total horas", pageWidth - 76, y, { align: "right" });
  doc.text(`${invoice.totalHours.toFixed(2)} h`, pageWidth - margin - 3, y, {
    align: "right",
  });
  y += 10;
  doc.setFontSize(14);
  doc.text("Total", pageWidth - 76, y, { align: "right" });
  doc.text(formatMoney(invoice.subtotal, project.currency), pageWidth - margin - 3, y, {
    align: "right",
  });

  if (invoice.notes) {
    y += 20;
    doc.setFontSize(10);
    doc.text("Notas", margin, y);
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(invoice.notes, pageWidth - margin * 2), margin, y + 8);
  }

  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text(
    `Generada desde Hora Clara - ${entries.length} registros, ${hoursFromMs(
      entries.reduce((total, entry) => total + entry.durationMs, 0),
    ).toFixed(2)} horas`,
    margin,
    287,
  );

  doc.save(`${invoice.number}.pdf`);
}
