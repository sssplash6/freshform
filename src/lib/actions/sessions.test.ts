import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { allocation, assignment, mentor, program, student } from "@/test/db";

/**
 * What authorizes a mentor to log time for a student.
 *
 * Three things do, and the third arrived with tasks that can be MOVED between
 * mentors: an admin can put a student's work on a mentor who holds no hours
 * there and was never in that program, and the log the task exists to produce
 * must not then be refused.
 */
const actor = vi.hoisted(() => ({ value: null as { id: string } | null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/dal", () => ({
  getCurrentUser: async () =>
    actor.value ? prisma.user.findUnique({ where: { id: actor.value.id } }) : null,
}));

const { logSession } = await import("@/lib/actions/sessions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

const log = (studentProfileId: string, extra: Record<string, string> = {}) =>
  logSession(
    null,
    form({ studentProfileId, minutes: "30", date: "2026-09-03", ...extra })
  );

describe("logSession authorization", () => {
  it("accepts a mentor whose task it is, with no hours and no program pairing", async () => {
    const p = await program("Master's");
    const s = await student({ programId: p.id });
    const m = await mentor("Umid");
    const task = await assignment({ studentId: s.id, mentorId: m.id });
    actor.value = m;

    const state = await log(s.id, { assignmentId: task.id });

    expect(state).toMatchObject({ ok: true });
    await expect(
      prisma.session.count({ where: { mentorId: m.id, studentId: s.id } })
    ).resolves.toBe(1);
  });

  it("still refuses a mentor with no hours, no pairing and no task there", async () => {
    const p = await program("Master's");
    const s = await student({ programId: p.id });
    const m = await mentor();
    actor.value = m;

    const state = await log(s.id);

    expect(state).toMatchObject({ ok: false, field: "studentProfileId" });
    await expect(prisma.session.count()).resolves.toBe(0);
  });

  it("accepts a mentor who holds hours there, task or no task", async () => {
    const p = await program("Master's");
    const s = await student({ programId: p.id });
    const m = await mentor();
    await allocation({ studentId: s.id, mentorId: m.id, minutes: 600 });
    actor.value = m;

    const state = await log(s.id);

    expect(state).toMatchObject({ ok: true });
  });
});
