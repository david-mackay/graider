import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  duplicateNameCounts,
  formatStudentDisplayName,
  rosterDisplayLabel,
  rosterEntryMatchesQuery,
  searchAndSortRoster,
} from "@/lib/roster-display";
import type { RosterEntry } from "@/lib/types";

const ada: RosterEntry = {
  user_id: "roster_1",
  full_name: "Ada Lovelace",
  email: "ada@school.test",
};

const ada2: RosterEntry = {
  user_id: "roster_2",
  full_name: "Ada Lovelace",
  email: "ada.l@school.test",
};

describe("roster-display", () => {
  it("never surfaces raw user ids as the label", () => {
    assert.equal(
      formatStudentDisplayName({ fullName: null, email: null, studentId: "user_abc", fallback: "Kid" }),
      "Kid",
    );
    assert.equal(formatStudentDisplayName({ fullName: "  Ada  " }), "Ada");
  });

  it("disambiguates duplicate names with email local part", () => {
    const counts = duplicateNameCounts([ada, ada2]);
    const label = rosterDisplayLabel(ada, counts);
    assert.match(label.primaryLabel, /Ada Lovelace \(ada\)/);
  });

  it("matches and ranks roster search", () => {
    assert.equal(rosterEntryMatchesQuery(ada, "lov"), true);
    assert.equal(rosterEntryMatchesQuery(ada, "zzz"), false);
    const sorted = searchAndSortRoster([ada2, ada], "ada");
    assert.equal(sorted.length, 2);
  });
});
