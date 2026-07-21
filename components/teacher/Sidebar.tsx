"use client";

import Link from "next/link";
import { IconBook, IconClipboard, IconHome, IconPen, IconUsers } from "@/components/shared/icons";
import BecomeStudentCard from "@/components/teacher/BecomeStudentCard";
import { ALL_CLASSES_VALUE } from "@/lib/dashboard-client";
import type { ActiveView, DashboardClass } from "@/lib/dashboard-types";

type TeacherNavItem = { id: ActiveView; label: string; Icon: (props: { className?: string }) => React.ReactNode };

const NAV_ITEMS: TeacherNavItem[] = [
  { id: "classes", label: "Classes", Icon: IconHome },
  { id: "questions", label: "Questions", Icon: IconBook },
  { id: "tests", label: "Tests", Icon: IconClipboard },
  { id: "students", label: "Students", Icon: IconUsers },
];

type TeacherSidebarProps = {
  classes: DashboardClass[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  profileName: string | null;
  onStatus?: (message: string, type?: "info" | "error") => void;
};

export default function TeacherSidebar({
  classes,
  selectedClassId,
  onSelectClass,
  activeView,
  onNavigate,
  profileName,
  onStatus,
}: TeacherSidebarProps) {
  const activeClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-line-soft">
        <Link
          href="/t/grade"
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-pen px-3 py-2.5 text-sm font-bold text-white shadow-paper transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
        >
          <IconPen className="h-4 w-4 flex-shrink-0" />
          <span>Grade a stack</span>
        </Link>
      </div>
      <div className="p-4 border-b border-line-soft">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">Active class</p>
        <select
          className="w-full cursor-pointer rounded-xl border border-line bg-cream px-3 py-2 text-sm font-bold text-ink outline-none transition-colors duration-150 focus:border-pen/50 focus:ring-2 focus:ring-pen-wash"
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
        {selectedClassId !== ALL_CLASSES_VALUE && activeClass ? (
          <p className="mt-1.5 text-xs text-ink-faint">
            You are a <span className="font-bold text-pen">{activeClass.role_in_class ?? "member"}</span>
          </p>
        ) : null}
      </div>

      <nav className="flex-1 p-3 space-y-0.5" aria-label="Teacher navigation">
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
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream-deep font-display text-xs font-bold text-ink">
              {profileName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{profileName}</p>
              <p className="text-xs text-ink-faint">Teacher</p>
            </div>
          </div>
          <BecomeStudentCard onStatus={onStatus} />
        </div>
      ) : null}
    </div>
  );
}
