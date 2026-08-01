/**
 * Whether OCR / stack commit may write answers onto an existing attempt.
 * Digital student attempts must never be clobbered (GR-04..GR-06).
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
        "This student still has an in-progress digital attempt. Wait for them to submit, or clear that attempt before grading a paper stack.",
    };
  }
  return {
    ok: false,
    status: 409,
    reason:
      "This student already submitted digitally. Stack OCR cannot overwrite a digital submission.",
  };
}
