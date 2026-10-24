"use client";

import { useEffect, useState } from "react";
import { serviceCities, type City } from "../lib/api";
import { field } from "./ui";

/** The cities DriveWay runs in, as set up in the admin panel. `null` while loading. */
export function useServiceCities(): { cities: City[] | null; error: string | null } {
  const [cities, setCities] = useState<City[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    serviceCities().then((c) => { if (live) setCities(c); }, (e) => { if (live) { setError((e as Error).message); setCities([]); } });
    return () => { live = false; };
  }, []);
  return { cities, error };
}

const chip = (on: boolean): React.CSSProperties => ({
  padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600,
  background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)",
  border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)",
});

/** Pick one service city: chips for a handful, a dropdown grouped by state once there are many. */
export function CityPicker({ cities, value, onChange, id }: { cities: City[] | null; value: string; onChange: (city: string) => void; id?: string }) {
  if (cities === null) return <p style={{ margin: 0, fontSize: 13, color: "var(--on-bg-soft)" }}>Loading cities…</p>;
  if (cities.length === 0) return <p style={{ margin: 0, fontSize: 13, color: "var(--on-bg-soft)" }}>DriveWay isn&apos;t taking riders anywhere right now. Please check back soon.</p>;
  if (cities.length <= 6) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cities.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c.name)} aria-pressed={c.name === value} style={chip(c.name === value)}>{c.name}</button>
        ))}
      </div>
    );
  }
  const states = [...new Set(cities.map((c) => c.state))].sort();
  return (
    <select id={id} value={cities.some((c) => c.name === value) ? value : ""} onChange={(e) => onChange(e.target.value)} style={{ ...field, appearance: "auto" }}>
      <option value="" disabled>Choose your city</option>
      {states.map((s) => (
        <optgroup key={s} label={s}>
          {cities.filter((c) => c.state === s).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/** CityPicker that loads the service cities itself. */
export function CityField({ value, onChange, id }: { value: string; onChange: (city: string) => void; id?: string }) {
  const { cities } = useServiceCities();
  return <CityPicker id={id} cities={cities} value={value} onChange={onChange} />;
}
