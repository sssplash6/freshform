import { SendIcon } from "@/components/icons";

/**
 * A student's Telegram handle rendered as an explicit button that opens their
 * Telegram profile (t.me/username) in a new tab. Used in student lists and on
 * the full student pages so the handle reads clearly as clickable.
 */
export function TelegramHandle({
  username,
  className = "",
}: {
  username: string;
  className?: string;
}) {
  return (
    <a
      href={`https://t.me/${username}`}
      target="_blank"
      rel="noreferrer"
      title={`Open @${username} on Telegram`}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:border-brand hover:bg-brand/5 ${className}`}
    >
      <SendIcon className="h-3.5 w-3.5" />@{username}
    </a>
  );
}
