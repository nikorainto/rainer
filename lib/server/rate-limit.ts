const buckets = new Map<string, number[]>();

/** True when this key is still inside its window. Oldest keys are dropped past the cap. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const cutoff = now - windowMs;
  const bucket = (buckets.get(key) ?? []).filter((stamp) => stamp > cutoff);
  if (bucket.length >= limit) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 5_000) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
  return true;
}

export function resetLimits() {
  buckets.clear();
}
