import { describe, expect, it } from "vitest";

import { mentorCaseload } from "@/lib/queries";
import { allocation, assignment, mentor, program, student } from "@/test/db";

/**
 * "Who are my students?" — the question `/mentor` opens with.
 *
 * Hours and tasks are separate rows, and a task can be moved between mentors
 * on its own while the hours stay banked with whoever they were granted to. So
 * a caseload built only from hours answered this question with ten people for
 * a mentor whose list held dozens of students' work.
 */
describe("mentorCaseload", () => {
  it("lists a student whose task is this mentor's, with no hours and no sessions", async () => {
    const p = await program("Master's");
    const s = await student({ programId: p.id, name: "Guzal" });
    const m = await mentor("Umid");
    await assignment({ studentId: s.id, mentorId: m.id, purpose: "Essay writing" });

    const { students } = await mentorCaseload(m.id);

    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({
      reach: "task",
      allocated: 0,
      remaining: 0,
      deadline: null,
    });
    expect(students[0].profile.id).toBe(s.id);
  });

  it("does not list a student over a task nobody owns yet", async () => {
    const p = await program("Master's");
    const s = await student({ programId: p.id });
    const m = await mentor();
    await assignment({ studentId: s.id, mentorId: null });

    const { students } = await mentorCaseload(m.id);

    expect(students).toHaveLength(0);
  });

  it("keeps a student the mentor already holds hours with as one allocation row", async () => {
    const p = await program("Master's");
    const s = await student({ programId: p.id });
    const m = await mentor();
    await allocation({ studentId: s.id, mentorId: m.id, minutes: 600 });
    await assignment({ studentId: s.id, mentorId: m.id });

    const { students } = await mentorCaseload(m.id);

    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({ reach: "allocation", allocated: 600 });
  });

  it("names a task student once, however many tasks of theirs are this mentor's", async () => {
    const p = await program("Master's");
    const s = await student({ programId: p.id });
    const m = await mentor();
    await assignment({ studentId: s.id, mentorId: m.id, purpose: "Essay writing" });
    await assignment({
      studentId: s.id,
      mentorId: m.id,
      purpose: "University list building",
      position: 1,
    });

    const { students } = await mentorCaseload(m.id);

    expect(students).toHaveLength(1);
    expect(students[0].reach).toBe("task");
  });
});
