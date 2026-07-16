// Replay determinism depends on the engine never reading the clock or
// randomness. See docs/adr/0001.
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(__dirname, '..', 'src');
const FORBIDDEN = /Date\.now|new Date\(|Math\.random/;

function listTsFiles(dir: string): string[] {
  // Node 20+ supports a recursive readdir that returns paths relative
  // to dir. We only need plain files ending in .ts.
  const names = fs.readdirSync(dir, { recursive: true }) as string[];
  return names
    .filter((name) => name.endsWith('.ts'))
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).isFile());
}

describe('engine purity', () => {
  it('contains no clock reads or randomness in any src file', () => {
    const files = listTsFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(FORBIDDEN);
    }
  });
});
