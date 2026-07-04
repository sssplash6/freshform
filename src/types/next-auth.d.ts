import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Our database User.id (not the Google subject). */
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}
