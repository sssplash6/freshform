import { prisma } from "@/lib/prisma";
import { ROLES, SESSION_STATUS } from "@/lib/constants";

/**
 * Test fixtures. The factories build the smallest row that satisfies the
 * schema's required columns and its foreign keys, so a test states only what it
 * is actually about — `session({ minutes: 60, attended: false })` rather than
 * eleven columns of scaffolding.
 */

/** Delete order matters: children before the rows they point at. */
export async function resetDb() {
  await prisma.interview.deleteMany();
  await prisma.session.deleteMany();
  await prisma.hourAllotmentChange.deleteMany();
  await prisma.hourAllocation.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.mentorFeedback.deleteMany();
  await prisma.websiteFeedback.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.mentorAssignment.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.avatarImage.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.program.deleteMany();
}

/** Unique-per-call email, so two factories in one test never collide. */
let seq = 0;
const nextEmail = (prefix: string) => `${prefix}-${++seq}@test.invalid`;

export const DAY = 24 * 60 * 60 * 1000;
/** A fixed clock: tests must never depend on the day they run. */
export const NOW = new Date("2026-09-03T12:00:00.000Z");
export const inDays = (n: number) => new Date(NOW.getTime() + n * DAY);

export async function program(name = "Test Program") {
  return prisma.program.create({ data: { name } });
}

export async function mentor(name = "Test Mentor") {
  return prisma.user.create({
    data: { email: nextEmail("mentor"), name, role: ROLES.MENTOR },
  });
}

export async function admin(name = "Test Admin") {
  return prisma.user.create({
    data: { email: nextEmail("admin"), name, role: ROLES.ADMIN },
  });
}

/** A student and their profile; the profile id is what the hours engine takes. */
export async function student(opts: { programId?: string; name?: string } = {}) {
  const programId = opts.programId ?? (await program()).id;
  const [user, createdBy] = await Promise.all([
    prisma.user.create({
      data: {
        email: nextEmail("student"),
        name: opts.name ?? "Test Student",
        role: ROLES.STUDENT,
      },
    }),
    admin("Creator"),
  ]);
  return prisma.studentProfile.create({
    data: { userId: user.id, programId, createdById: createdBy.id },
  });
}

export async function allocation(opts: {
  studentId: string;
  mentorId?: string | null;
  minutes: number;
  /** Days from NOW; negative is an expired allocation. Default: 30 days out. */
  deadlineInDays?: number;
  amountPaid?: number | null;
}) {
  return prisma.hourAllocation.create({
    data: {
      studentId: opts.studentId,
      mentorId: opts.mentorId ?? null,
      minutes: opts.minutes,
      deadline: inDays(opts.deadlineInDays ?? 30),
      amountPaid: opts.amountPaid ?? null,
    },
  });
}

export async function session(opts: {
  studentId: string;
  mentorId: string;
  minutes: number;
  attended?: boolean;
  late?: boolean;
  status?: string;
  withinPlan?: boolean;
  assignmentId?: string | null;
}) {
  return prisma.session.create({
    data: {
      studentId: opts.studentId,
      mentorId: opts.mentorId,
      minutes: opts.minutes,
      date: inDays(-1),
      attended: opts.attended ?? true,
      late: opts.late ?? false,
      status: opts.status ?? SESSION_STATUS.ACTIVE,
      withinPlan: opts.withinPlan ?? true,
      assignmentId: opts.assignmentId ?? null,
    },
  });
}
