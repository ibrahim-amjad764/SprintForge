interface Props {
  title: string;
  value: number;
}

export default function StatsCard({
  title,
  value,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
