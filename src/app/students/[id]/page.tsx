import { redirect } from "next/navigation";

import { ROLES, canActAsMentor, type Role } from "@/lib/constants";
import { requireUser } from "@/lib/dal";

/**
 * `/students/<id>` — one address for a student, whoever is asking.
 *
 * `lib/status.ts` builds every attention row's link, and it must not know who
 * is reading: the whole point of the status model is that one derivation serves
 * staff, mentors and students, and a module that has to choose between
 * `/admin/students/x` and `/mentor/students/x` is a module that knows about
 * roles again. So it links here, and here decides.
 *
 * This is the seed of the role-neutral routes REDESIGN.md §6.7 describes — the
 * real page, with one layout and per-viewer sections, arrives in Phase 6. Until
 * then this redirects to whichever of the two existing pages the viewer is
 * entitled to, which is enough for every link in the app to resolve.
 *
 * An admin who also mentors lands on the admin page: it is the one with more on
 * it, and ⌥M switches to the mentor view from there.
 */
export default async function StudentRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const role = user.role as Role;

  if (role === ROLES.ADMIN || role === ROLES.DEPT_LEADER || role === ROLES.SALES) {
    redirect(`/admin/students/${id}`);
  }
  if (canActAsMentor(user)) {
    redirect(`/mentor/students/${id}`);
  }
  // A student has no page for another student, and their own is their home.
  redirect("/student");
}
