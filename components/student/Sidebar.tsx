"use client";

import { IconClipboard, IconHome } from "@/components/shared/icons";
import { ALL_CLASSES_VALUE } from "@/lib/dashboard-client";
import type { ActiveView, DashboardClass } from "@/lib/dashboard-types";

type StudentNavItem = { id: ActiveView; label: string; Icon: (props: { className?: string }) => React.ReactNode };

const NAV_ITEMS: StudentNavItem[] = [
  { id: "classes", label: "My Classes", Icon: IconHome },
  { id: "tests", label: "My Tests", Icon: IconClipboard },
];

type StudentSidebarProps = {
  classes: DashboardClass[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  profileName: string | null;
};

export default function StudentSidebar({
  classes,
  selectedClassId,
  onSelectClass,
  activeView,
  onNavigate,
  profileName,
}: StudentSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Class selector — students see their enrolled classes */}
      {classes.length > 1 ? (
        <div className="p-4 border-b border-line-soft">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Active class</p>
          <select
            className="w-full cursor-pointer rounded-lg border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-pen/50 focus:ring-2 focus:ring-pen-wash transition-colors duration-150"
            value={selectedClassId}
            onChange={(e) => onSelectClass(e.target.value)}
          >
            <option value={ALL_CLASSES_VALUE}>All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <nav className="flex-1 p-3 space-y-0.5" aria-label="Student navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`cursor-pointer w-full flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold transition-colors duration-150 ${
                isActive ? "bg-pen-wash text-pen-deep" : "text-ink-soft hover:bg-cream hover:text-ink"
              }`}
            >
              <item.Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-pen" : "text-ink-faint"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {profileName ? (
        <div className="p-4 border-t border-line-soft">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream-deep text-xs font-bold text-pen">
              {profileName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{profileName}</p>
              <p className="text-xs text-ink-faint">Student</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
