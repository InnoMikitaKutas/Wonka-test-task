// Serializes a value with object keys sorted at every level. Arrays keep
// their order. Sorted keys make the output independent of property
// insertion order, so the hash of a state depends only on its content.
// tools/replay and the golden tests rely on this. See docs/adr/0001.
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => {
      const child = (value as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${canonicalStringify(child)}`;
    });
  return `{${entries.join(',')}}`;
}
