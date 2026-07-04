import { signIn } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "This Google account isn't registered. Students must be added by staff first; mentors must use their @freshman.academy account.",
  Configuration: "Sign-in is misconfigured. Please contact the site admin.",
  Default: "Something went wrong signing you in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <main className="flex flex-1 items-center justify-center bg-mist/40 p-6">
      <div className="w-full max-w-sm rounded-xl border border-mist bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-navy">Freshman Academy</h1>
        <p className="mt-1 text-sm text-gray-500">
          Mentoring hours — sign in to continue
        </p>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy/90"
          >
            Sign in with Google
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-400">
          Students: use the email your program registered. Mentors: use your
          @freshman.academy account.
        </p>
      </div>
    </main>
  );
}
