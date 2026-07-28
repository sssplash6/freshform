import { FileIcon } from "@/components/icons";

/**
 * A student's file (a Drive/Docs/… link staff attached when registering them)
 * rendered as an explicit button that opens it in a new tab. Used in student
 * lists and on the full student pages, matching TelegramHandle so the two
 * "reach the student" affordances read as one pair.
 */
export function StudentFileLink({
  url,
  className = "",
}: {
  url: string;
  className?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`Open the student's file (${url})`}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:border-brand hover:bg-brand/5 ${className}`}
    >
      <FileIcon className="h-3.5 w-3.5" />
      File
    </a>
  );
}
