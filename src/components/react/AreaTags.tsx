import { formatArea } from "../../lib/problems";

export default function AreaTags({ areas }: { areas: string[] }) {
  return (
    <ul className="area-tags">
      {areas.map((area) => (
        <li key={area}>
          <a href={`/problems?area=${encodeURIComponent(area)}`}>{formatArea(area)}</a>
        </li>
      ))}
    </ul>
  );
}
