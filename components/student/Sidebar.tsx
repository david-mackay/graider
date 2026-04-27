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
        <div className="p-4 border-b border-indigo-100/60">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300">Active class</p>
          <select
            className="w-full cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-2 text-sm text-indigo-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors duration-150"
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
              className={`cursor-pointer w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-700"
              }`}
            >
              <item.Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {profileName ? (
        <div className="p-4 border-t border-indigo-100/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
              {profileName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-indigo-950">{profileName}</p>
              <p className="text-xs text-slate-400">Student</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
