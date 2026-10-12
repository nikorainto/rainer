export type PhotonProperties = {
  name?: string;
  street?: string;
  district?: string;
  locality?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type PlaceHit = {
  name: string;
  lat: number;
  lon: number;
};

function clean(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, 80);
}

/** Search row: the matched name plus the nearest broader place. */
export function searchLabel(props: PhotonProperties): string | null {
  const name = clean(props.name) ?? clean(props.street) ?? clean(props.city);
  if (!name) return null;
  const place = [clean(props.city), clean(props.state), clean(props.country)].find(
    (part) => part && part !== name,
  );
  const label = place ? `${name}, ${place}` : name;
  return label.slice(0, 160);
}

/** Reverse row: neighborhood or street, then the town. */
export function reverseLabel(props: PhotonProperties): string | null {
  const local =
    clean(props.district) ?? clean(props.locality) ?? clean(props.name) ?? clean(props.street);
  const region = clean(props.city) ?? clean(props.state) ?? clean(props.country);
  if (!local && !region) return null;
  if (local && region && local !== region) return `${local}, ${region}`.slice(0, 160);
  return (local ?? region)?.slice(0, 160) ?? null;
}
