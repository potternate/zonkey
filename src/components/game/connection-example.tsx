export function ConnectionExample() {
  return (
    <div className="rounded-2xl border bg-card p-4 text-center" aria-label="Example: donkey and zebra connect when you and the AI both choose Zonkey.">
      <p className="eyebrow text-muted-foreground">You open with donkey. AI reveals zebra.</p>
      <div className="mt-3 flex items-center justify-center gap-4 text-lg font-bold">
        <span>donkey</span>
        <span className="text-primary" aria-label="and">↔</span>
        <span>zebra</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-success-border bg-success-muted p-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">You pick</dt>
          <dd className="mt-1 text-lg font-bold text-success">Zonkey</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">AI picks</dt>
          <dd className="mt-1 text-lg font-bold text-success">Zonkey</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">Same word. Connected.</p>
    </div>
  );
}
