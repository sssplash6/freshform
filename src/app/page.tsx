import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { homeFor, profileOf } from "@/lib/profile";

/**
 * `/` is a redirect, resolved on the server: whoever you are, and whichever
 * lens you last chose, this is the door to the right home. Nothing renders
 * here, so nothing flashes on the way through.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(homeFor(user, await profileOf(user)));
}
