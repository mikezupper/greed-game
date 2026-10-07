import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
function compress(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) compress(file);
    else if (/\.(html|js|css|svg|json|wasm)$/.test(entry.name)) {
      const data = readFileSync(file); writeFileSync(`${file}.gz`, gzipSync(data)); writeFileSync(`${file}.br`, brotliCompressSync(data));
    }
  }
}
compress('dist');
