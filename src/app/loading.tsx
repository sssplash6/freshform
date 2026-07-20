/** Route fallback: quiet skeleton in the page's shape, no spinner. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 animate-pulse px-4 py-10">
      <div className="h-9 w-64 rounded-md bg-canvas" />
      <div className="mt-3 h-4 w-44 rounded bg-canvas" />
      <div className="mt-10 flex gap-14 border-y border-line py-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-9 w-16 rounded bg-canvas" />
            <div className="mt-2 h-3 w-24 rounded bg-canvas" />
          </div>
        ))}
      </div>
      <div className="mt-10 h-40 rounded-lg border border-line bg-canvas" />
    </div>
  );
}
