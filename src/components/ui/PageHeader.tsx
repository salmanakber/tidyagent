export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-navy-300">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
