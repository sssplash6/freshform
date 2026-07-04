import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { ALLOWED_MENTOR_DOMAIN } from "../../config/app-config";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

/**
 * Sign-in policy (spec §6):
 * - Everyone authenticates with Google.
 * - Emails already in the User table (seeded staff, staff-created students,
 *   returning mentors) may sign in.
 * - Unknown emails on ALLOWED_MENTOR_DOMAIN self-register as UNASSIGNED
 *   mentors; an admin must assign them to cohorts before they can do
 *   anything.
 * - All other unknown emails are rejected.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Backfill the name from Google for staff/students created by email only.
        if (!existing.name && user.name) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { name: user.name },
          });
        }
        return true;
      }

      // Unknown email: only mentor self-sign-up on the allowed domain.
      if (email.endsWith(`@${ALLOWED_MENTOR_DOMAIN}`)) {
        await prisma.user.create({
          data: {
            email,
            name: user.name ?? null,
            role: ROLES.MENTOR,
            status: USER_STATUS.UNASSIGNED,
          },
        });
        return true;
      }

      return false;
    },
    async jwt({ token, user }) {
      // On initial sign-in, pin the JWT to our DB user id. Role/status are
      // intentionally NOT stored in the token — the DAL reads them fresh from
      // the DB on every request, so admin changes (e.g. assigning a mentor)
      // take effect without re-login.
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { id: true },
        });
        if (dbUser) token.uid = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
