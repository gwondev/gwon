import { parseTechItem } from "../lib/techStackDisplay";

export default function StackChip({ item }) {
  const { label, accent } = parseTechItem(item);
  return (
    <span className={`stack-chip${accent ? " stack-chip--accent" : ""}`} title={accent ? "강조" : undefined}>
      {label}
    </span>
  );
}
