import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = process.cwd(), errors: string[] = [];
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name); return entry.isDirectory() ? files(path) : [path];
});
const allowed: Record<string, readonly string[]> = {
  game: ['game'], physics: ['physics', 'game'], protocol: ['protocol', 'game', 'physics'],
  server: ['server', 'game', 'protocol', 'physics'], state: ['state', 'game', 'protocol', 'physics'],
  app: ['app', 'state', 'game', 'protocol'], rendering: ['rendering', 'physics', 'game'],
};
for (const file of files(resolve(root, 'src')).filter(f => extname(f) === '.ts')) {
  const rel = relative(root, file), layer = rel.split('/')[1] ?? '', content = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  if (content.split('\n').length > 300) errors.push(`${rel}: over 300 lines. Split by responsibility.`);
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith('.')) {
        const target = relative(resolve(root, 'src'), resolve(dirname(file), spec)).split('/')[0] ?? '';
        if (allowed[layer] && !allowed[layer]?.includes(target)) errors.push(`${rel}: ${layer} cannot import ${target}. See ARCHITECTURE.md.`);
      } else {
        if (layer === 'game') errors.push(`${rel}: pure game code cannot import ${spec}. Move the adapter out of game.`);
        if (spec === 'three' || spec.startsWith('three/')) if (layer !== 'rendering') errors.push(`${rel}: Three.js belongs in rendering.`);
        if (spec.includes('rapier') && layer !== 'physics') errors.push(`${rel}: Rapier belongs in physics.`);
        if (spec.startsWith('@gyral/') && layer !== 'app' && rel !== 'src/main.ts') errors.push(`${rel}: Gyral belongs in app or main.`);
      }
    }
    if (layer === 'game') {
      if (ts.isIdentifier(node) && ['Date', 'document', 'window', 'localStorage', 'fetch', 'crypto', 'performance', 'setTimeout', 'process'].includes(node.text)) errors.push(`${rel}: ${node.text} is a runtime effect; keep game pure.`);
      if (ts.isPropertyAccessExpression(node) && node.expression.getText(ast) === 'Math' && node.name.text === 'random') errors.push(`${rel}: randomness must enter through a runtime adapter.`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
const docs = [resolve(root, 'AGENTS.md'), resolve(root, 'README.md'), resolve(root, 'ARCHITECTURE.md'),
  ...files(resolve(root, 'docs')).filter(f => f.endsWith('.md') && !f.includes('/references/'))];
for (const file of docs) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const link = match[1]?.split('#')[0];
    if (!link || /^[a-z]+:/i.test(link)) continue;
    if (!existsSync(resolve(dirname(file), link))) errors.push(`${relative(root, file)}: broken link ${link}. Update the repository map.`);
  }
}
if (readFileSync('AGENTS.md', 'utf8').split('\n').length > 100) errors.push('AGENTS.md: keep this a map of at most 100 lines.');
const vendor = 'vendor/gyral/0.3.1-next.1';
for (const line of readFileSync(`${vendor}/SHA256SUMS`, 'utf8').trim().split('\n')) {
  const [expected, name] = line.trim().split(/\s+/);
  if (!name || createHash('sha256').update(readFileSync(`${vendor}/${name}`)).digest('hex') !== expected) errors.push(`Vendor checksum mismatch: ${name}. Restore the original release artifact.`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Repository boundaries, documentation links, guide size and vendor checksums passed.');
