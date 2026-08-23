"use client";

import {
  presetsForSurface,
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
  surface,
  value,
  onChange,
  disabled = false,
  className = "",
}: ParsePresetPickerProps) {
  const options = presetsForSurface(surface);
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
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
