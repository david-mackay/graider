"use client";

import {
  PARSE_PRESET_OPTIONS,
  type DocumentParsePreset,
  type ParseSurface,
} from "@/lib/parse-presets";
import { inputClass } from "@/components/shared/ui";

type ParsePresetPickerProps = {
  surface: ParseSurface;
  value: DocumentParsePreset;
  onChange: (preset: DocumentParsePreset) => void;
  disabled?: boolean;
  className?: string;
};

export default function ParsePresetPicker({
  value,
  onChange,
  disabled = false,
  className = "",
}: ParsePresetPickerProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Document type
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as DocumentParsePreset)}
        className={`${inputClass} mt-1.5`}
        aria-label="Document type for parsing"
      >
        {PARSE_PRESET_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
