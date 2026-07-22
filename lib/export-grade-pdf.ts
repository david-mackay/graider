import { jsPDF } from "jspdf";
import type { GradedAttemptDetail } from "@/lib/dashboard-types";

export type GradePdfOptions = {
  includeGrade: boolean;
  includeFeedback: boolean;
  studentName?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared HTML used for on-screen preview (and mobile print pipeline). No product branding. */
export function buildGradeHtml(attempt: GradedAttemptDetail, options: GradePdfOptions): string {
  const studentLabel = escapeHtml(
    options.studentName?.trim() || attempt.student_name?.trim() || "Unnamed student",
  );
  const testTitle = escapeHtml(attempt.test_title);
  const gradeBlock =
    options.includeGrade && attempt.total_marks != null && attempt.max_marks != null
      ? `<p class="grade">${attempt.total_marks} / ${attempt.max_marks}</p>`
      : "";

  const questions = attempt.questions
    .map((question, index) => {
      const prompt = escapeHtml(question.prompt);
      const answer = escapeHtml(question.student_answer || "—");
      const marks =
        options.includeGrade && question.marks_earned != null
          ? `<span class="marks">${question.marks_earned} / ${question.marks}</span>`
          : "";
      const feedback =
        options.includeFeedback && question.feedback
          ? `<p class="feedback">${escapeHtml(question.feedback)}</p>`
          : "";

      return `
        <section class="question">
          <div class="question-head">
            <h3>Question ${index + 1}</h3>
            ${marks}
          </div>
          <p class="prompt">${prompt}</p>
          <p class="answer"><strong>Answer:</strong> ${answer}</p>
          ${feedback}
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
        color: #2c231b;
        background: #fdfaf1;
        padding: 28px;
        line-height: 1.45;
      }
      h1 {
        font-size: 24px;
        margin: 0 0 4px;
      }
      .meta {
        color: #6f6151;
        font-size: 13px;
        margin-bottom: 18px;
      }
      .grade {
        font-size: 28px;
        color: #be3a2e;
        font-weight: 700;
        margin: 0 0 18px;
      }
      .question {
        border: 1px solid #e5d9c0;
        border-radius: 12px;
        background: #fff;
        padding: 14px;
        margin-bottom: 12px;
        page-break-inside: avoid;
      }
      .question-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
      }
      h3 {
        margin: 0;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #a3927b;
      }
      .marks {
        color: #be3a2e;
        font-weight: 700;
        font-size: 14px;
      }
      .prompt {
        margin: 8px 0;
        font-size: 15px;
      }
      .answer {
        margin: 0;
        font-size: 14px;
        color: #2c231b;
      }
      .feedback {
        margin: 10px 0 0;
        padding: 10px;
        border-radius: 8px;
        background: #f6efe1;
        font-size: 13px;
        color: #4a7c59;
      }
    </style>
  </head>
  <body>
    <h1>${testTitle}</h1>
    <p class="meta">${studentLabel}</p>
    ${gradeBlock}
    ${questions}
  </body>
</html>`;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

/** Build a downloadable PDF blob matching the graded-paper layout (no product title). */
export async function generateAttemptPdf(
  attempt: GradedAttemptDetail,
  options: GradePdfOptions,
): Promise<{ blob: Blob; filename: string; url: string }> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const studentLabel =
    options.studentName?.trim() || attempt.student_name?.trim() || "Unnamed student";

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(44, 35, 27);
  y = wrapText(doc, attempt.test_title, margin, y, maxWidth, 22);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(111, 97, 81);
  y = wrapText(doc, studentLabel, margin, y, maxWidth, 14);
  y += 10;

  if (options.includeGrade && attempt.total_marks != null && attempt.max_marks != null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(190, 58, 46);
    y = wrapText(doc, `${attempt.total_marks} / ${attempt.max_marks}`, margin, y, maxWidth, 26);
    y += 12;
  }

  for (let index = 0; index < attempt.questions.length; index += 1) {
    const question = attempt.questions[index]!;
    ensureSpace(90);

    doc.setDrawColor(229, 217, 192);
    doc.setFillColor(255, 255, 255);
    const blockTop = y - 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(163, 146, 123);
    doc.text(`QUESTION ${index + 1}`, margin + 10, y + 12);

    if (options.includeGrade && question.marks_earned != null) {
      doc.setTextColor(190, 58, 46);
      doc.text(`${question.marks_earned} / ${question.marks}`, pageWidth - margin - 10, y + 12, {
        align: "right",
      });
    }

    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(44, 35, 27);
    y = wrapText(doc, question.prompt, margin + 10, y, maxWidth - 20, 14);
    y += 8;

    doc.setFontSize(10);
    y = wrapText(
      doc,
      `Answer: ${question.student_answer || "—"}`,
      margin + 10,
      y,
      maxWidth - 20,
      13,
    );

    if (options.includeFeedback && question.feedback) {
      y += 8;
      doc.setTextColor(74, 124, 89);
      y = wrapText(doc, question.feedback, margin + 10, y, maxWidth - 20, 13);
      doc.setTextColor(44, 35, 27);
    }

    y += 14;
    const blockBottom = y;
    doc.roundedRect(margin, blockTop, maxWidth, blockBottom - blockTop, 8, 8, "S");
    y += 12;
  }

  const filename = `${sanitizeFilename(attempt.test_title)}-${sanitizeFilename(studentLabel)}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return { blob, filename, url };
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Web share sheet when available; otherwise download the PDF. */
export async function sharePdfBlob(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof navigator.share === "function" && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return "shared";
    } catch (error) {
      // User cancel — don't fall through to download.
      if (error instanceof DOMException && error.name === "AbortError") {
        return "shared";
      }
    }
  }
  downloadPdfBlob(blob, filename);
  return "downloaded";
}

/** Open the generated PDF in a new tab (browser PDF viewer / print-ready). */
export function openPdfPreview(url: string) {
  const win = window.open(url, "_blank");
  if (!win) {
    throw new Error("Could not open PDF preview. Allow pop-ups and try again.");
  }
  win.focus();
}

/**
 * Open an HTML print preview and trigger the browser print dialog
 * (Save as PDF / print). Avoids noopener so document.write works.
 */
export function openPrintPreview(html: string) {
  const win = window.open("about:blank", "_blank");
  if (!win) {
    throw new Error("Could not open PDF preview. Allow pop-ups and try again.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give the document a moment to layout before print.
  win.focus();
  window.setTimeout(() => {
    try {
      win.print();
    } catch {
      // Print can fail in some browsers; the preview tab still remains usable.
    }
  }, 250);
}
