interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

/** A bordered, divided 3-up icon row — the reference's "Run everywhere / anywhere / at massive
 * scale" strip. Column dividers (not card borders) read as one connected statement rather than
 * three separate cards, which is the effect this section is going for. */
export function FeatureRow({ features }: { features: Feature[] }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border-hairline border-y border-border-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {features.map((feature) => (
        <div key={feature.title} className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          {feature.icon}
          <h3 className="text-h4 font-semibold">{feature.title}</h3>
          <p className="max-w-[28ch] text-body-sm text-muted-foreground">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
