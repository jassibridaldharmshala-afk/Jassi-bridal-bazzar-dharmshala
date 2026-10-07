// Mechanical migration of known brand colours only. Status colours, preset
// definitions, assets, tests and third-party provider branding are not changed.
// Run with --write to apply; without it, report remaining legacy UI colours.
const fs = require('node:fs');
const path = require('node:path');
const palette = require('../src/config/themePalette.json');
const src = path.resolve(__dirname, '../src');
const colors = new Map(Object.entries(palette).flatMap(([token, data]) => data.colors.map(hex => [hex, { token, variable: data.variable }])));
// Additional audited brand decoration, not error/success/warning colours.
for (const hex of ['5f102d', 'a7164b', '8f173b', '5f102a', '811b3d', 'a42a50', '68152f', '9a5269', '8a4b61', '8a0f36', '970f3e', '7b1934', '8b1538', '8b0e35', '751c39', '801d3e', '7a1d3b', '711d36', '7b1d3d', '6f0829', '781d3c']) colors.set(hex, { token: 'wine', variable: '--site-primary' });
for (const hex of ['fffaf4', 'fffdfb', 'f8f3ec', 'fff8f2']) colors.set(hex, { token: 'ivory', variable: '--site-background' });
let changed = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { visit(file); continue; }
    if (!/\.(css|jsx)$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
    const old = fs.readFileSync(file, 'utf8');
    let next;
    if (entry.name.endsWith('.css')) {
      next = old.replace(/var\([^()]*\)|#[0-9a-f]{6}\b/gi, value => {
        if (value.startsWith('var(')) return value;
        const match = colors.get(value.slice(1).toLowerCase());
        return match ? `var(${match.variable}, ${value})` : value;
      });
      next = next.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/g, (value, r, g, b, alpha) => {
        const hex = [r, g, b].map(value => Number(value).toString(16).padStart(2, '0')).join('');
        const match = colors.get(hex);
        return match ? `color-mix(in srgb, var(${match.variable}) ${Math.round(Number(alpha ?? 1) * 10000) / 100}%, transparent)` : value;
      });
    } else {
      next = old.replace(/-\[#([0-9a-f]{6})\]/gi, (value, hex) => {
        const match = colors.get(hex.toLowerCase());
        return match ? `-${match.token}` : value;
      });
    }
    if (next === old) continue;
    changed += 1;
    if (process.argv.includes('--write')) fs.writeFileSync(file, next);
    console.log(path.relative(src, file));
  }
}
visit(src);
console.log(`${changed} UI files ${process.argv.includes('--write') ? 'migrated' : 'would change'}.`);
