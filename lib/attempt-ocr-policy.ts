/**
 * Whether OCR may write answers onto an existing named attempt.
 * Digital student attempts must never be clobbered (GR-04..GR-06).
 * Stack commit creates a new teacher_ocr attempt instead of using this gate.
 */
export function canApplyOcrToAttempt(params: {
  source: string | null | undefined;
  submittedAt: Date | string | null | undefined;
}): { ok: true } | { ok: false; status: 409; reason: string } {
  if (params.source !== "student") {
    return { ok: true };
  }
  if (!params.submittedAt) {
    return {
      ok: false,
      status: 409,
      reason:
        "This student still has an in-progress digital attempt. Wait for them to submit, or clear that attempt before grading their paper.",
    };
  }
  return {
    ok: false,
    status: 409,
    reason:
      "This student already submitted digitally. Stack OCR cannot overwrite a digital submission.",
  };
}
