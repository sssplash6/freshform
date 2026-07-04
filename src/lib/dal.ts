import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME, type Role } from "@/lib/constants";
import type { User } from "@/generated/prisma/client";

/**
 * Data-access-layer auth: every page, layout, server action, and route
 * handler goes through these. The JWT only carries the user id — role and
 * status are read fresh from the DB here, so permission changes apply
 * immediately.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
});

/** Require a signed-in user; otherwise send them to the login page. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require one of the given roles. A signed-in user with the wrong role is
 * sent to their own home instead of seeing someone else's pages.
 */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role as Role)) {
    redirect(ROLE_HOME[user.role as Role] ?? "/login");
  }
  return user;
}

/** Where this user's home is (used by the root page and error recovery). */
export function homeFor(user: User): string {
  return ROLE_HOME[user.role as Role] ?? "/login";
}
