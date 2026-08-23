/**
 * Reducto Parse/Extract already scores how sure it is.
 *
 * Parse blocks: `confidence` is `"high"` | `"low"`, plus optional
 * `granular_confidence.parse_confidence` (0–1).
 * Extract with citations: each field is `{ value, citations[] }`. Every
 * citation has the same band plus `granular_confidence.parse_confidence`
 * and `extract_confidence`. Empty citations usually means the model inferred
 * a value instead of grounding it on the page — treat that as needs review.
 *
 * We do not invent a second scoring model. We only threshold Reducto's scores.
 */

export const LOW_PARSE_CONFIDENCE_THRESHOLD = 0.7;

export type CitationConfidenceBand = "high" | "low";

export type CitedLeaf = {
  value: unknown;
  parseConfidence: number | null;
  extractConfidence: number | null;
  band: CitationConfidenceBand | null;
  /** True when Reducto marked the source as shaky or did not ground the value. */
  needsReview: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function isCitedWrapper(value: unknown): value is {
  value: unknown;
  citations?: unknown;
} {
  return isRecord(value) && "value" in value && "citations" in value;
}

function citationScores(citation: unknown): {
  parseConfidence: number | null;
  extractConfidence: number | null;
  band: CitationConfidenceBand | null;
} {
  if (!isRecord(citation)) {
    return { parseConfidence: null, extractConfidence: null, band: null };
  }
  const granular = isRecord(citation.granular_confidence)
    ? citation.granular_confidence
    : {};
  const parseConfidence = finiteNumber(granular.parse_confidence);
  const extractConfidence = finiteNumber(granular.extract_confidence);
  const band =
    citation.confidence === "high" || citation.confidence === "low"
      ? citation.confidence
      : null;
  return { parseConfidence, extractConfidence, band };
}

/** Unwrap a Reducto citation-wrapped leaf, or pass a plain value through. */
export function unwrapCitedLeaf(raw: unknown): CitedLeaf {
  if (!isCitedWrapper(raw)) {
    return {
      value: raw,
      parseConfidence: null,
      extractConfidence: null,
      band: null,
      needsReview: false,
    };
  }

  const citations = Array.isArray(raw.citations) ? raw.citations : [];
  if (citations.length === 0) {
    return {
      value: raw.value,
      parseConfidence: null,
      extractConfidence: null,
      band: null,
      needsReview: true,
    };
  }

  let parseConfidence: number | null = null;
  let extractConfidence: number | null = null;
  let band: CitationConfidenceBand | null = null;
  for (const citation of citations) {
    const scores = citationScores(citation);
    if (scores.parseConfidence !== null) {
      const next = clamp01(scores.parseConfidence);
      parseConfidence = parseConfidence === null ? next : Math.min(parseConfidence, next);
    }
    if (scores.extractConfidence !== null) {
      const next = clamp01(scores.extractConfidence);
      extractConfidence =
        extractConfidence === null ? next : Math.min(extractConfidence, next);
    }
    if (scores.band === "low") band = "low";
    else if (scores.band === "high" && band !== "low") band = "high";
  }

  const belowThreshold =
    (parseConfidence !== null && parseConfidence < LOW_PARSE_CONFIDENCE_THRESHOLD) ||
    (extractConfidence !== null && extractConfidence < LOW_PARSE_CONFIDENCE_THRESHOLD);

  return {
    value: raw.value,
    parseConfidence,
    extractConfidence,
    band,
    needsReview: band === "low" || belowThreshold,
  };
}

export function citedString(raw: unknown): {
  text: string;
  parseConfidence: number | null;
  extractConfidence: number | null;
  needsReview: boolean;
} {
  const leaf = unwrapCitedLeaf(raw);
  const text = typeof leaf.value === "string" ? leaf.value.trim() : "";
  return {
    text,
    parseConfidence: leaf.parseConfidence,
    extractConfidence: leaf.extractConfidence,
    needsReview: leaf.needsReview,
  };
}

export function citedNumber(raw: unknown): {
  value: number | null;
  needsReview: boolean;
} {
  const leaf = unwrapCitedLeaf(raw);
  const n = finiteNumber(leaf.value);
  return { value: n, needsReview: leaf.needsReview };
}

/** Peel citation wrappers off an array field (`questions`, `answers`, `pages`). */
export function citedArray(raw: unknown): unknown[] {
  const leaf = unwrapCitedLeaf(raw);
  return Array.isArray(leaf.value) ? leaf.value : Array.isArray(raw) ? raw : [];
}

export function minConfidence(
  ...values: Array<number | null | undefined>
): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Math.min(...nums);
}
