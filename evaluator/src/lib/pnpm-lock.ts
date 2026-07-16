// Shared helper: pull the set of runtime ("dependencies", not
// "devDependencies") package names out of a pnpm-lock.yaml, per
// importer. A plain indentation reader, not a real YAML parser; good
// enough as a heuristic signal for L5 and diff-report, never a hard
// fail on its own.

export function extractRuntimeDeps(text: string): Set<string> {
  const deps = new Set<string>();
  let inImporters = false;
  let section: string | null = null;

  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const trimmed = raw.trim();

    if (!inImporters) {
      if (trimmed === 'importers:') inImporters = true;
      continue;
    }
    if (indent === 0) {
      inImporters = trimmed === 'importers:';
      continue;
    }
    if (indent === 2 && trimmed.endsWith(':')) {
      section = null;
      continue;
    }
    if (indent === 4 && trimmed.endsWith(':')) {
      section = trimmed.slice(0, -1);
      continue;
    }
    if (indent === 6 && trimmed.endsWith(':') && section === 'dependencies') {
      let name = trimmed.slice(0, -1);
      if (/^(['"]).*\1$/.test(name)) name = name.slice(1, -1);
      deps.add(name);
    }
  }
  return deps;
}

export function addedRuntimeDeps(oldText: string, newText: string): string[] {
  const oldDeps = extractRuntimeDeps(oldText);
  const newDeps = extractRuntimeDeps(newText);
  return [...newDeps].filter((d) => !oldDeps.has(d)).sort();
}
