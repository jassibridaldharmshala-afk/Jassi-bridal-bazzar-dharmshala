const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const valueParser = require('postcss-value-parser');
const { parse } = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const literal = /^(?:#[\da-f]{3,8}|white|black|red|blue|green|yellow|orange|pink|purple|gray|grey|silver|gold|navy|teal|maroon)$/i;
const issues = [];
const report = (file, line, message) => issues.push(`${relative(file)}:${line}: ${message}`);
const declared = new Set();
const customProperties = new Set();
const legacyReferences = [];
const references = [];
const collectReferences = (file, source) => {
  for (const match of source.matchAll(/var\((--site-[\w-]+)/g)) references.push({ file, token: match[1] });
};
function checkValue(file, line, value) {
  valueParser(value).walk(node => {
    // Configured defaults may have a fallback; image URLs are product assets.
    if (node.type === 'function' && /^(var|url)$/i.test(node.value)) return false;
    if (node.type === 'function' && /^(rgb|rgba|hsl|hsla)$/i.test(node.value)
      && !valueParser.stringify(node).includes('var(')) {
      report(file, line, `Fixed colour ${valueParser.stringify(node)}; use a shared theme token.`);
      return false;
    }
    if (node.type === 'word' && literal.test(node.value)) report(file, line, `Fixed colour ${node.value}; use a shared theme token.`);
  });
}
function inspectNode(node, file) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'StringLiteral') {
    const classes = node.value.match(/(?:bg|text|border|ring|outline|decoration|fill|stroke|from|via|to|shadow)-(?:white|black|(?:gray|slate|zinc|stone|neutral|rose|pink|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia)-\d{2,3})(?:\b|\/)/g);
    if (classes) report(file, node.loc.start.line, `Fixed utility colours: ${[...new Set(classes)].join(', ')}.`);
    for (const match of node.value.matchAll(/(?:bg|text|border|ring|outline|decoration|fill|stroke|from|via|to|shadow)-\[([^\]]+)\]/g)) {
      checkValue(file, node.loc.start.line, match[1].replaceAll('_', ' '));
    }
  }
  if (node.type === 'JSXAttribute' && /^(fill|stroke|color|bgcolor)$/.test(node.name.name)
    && node.value?.type === 'StringLiteral') checkValue(file, node.loc.start.line, node.value.value);
  if (node.type === 'JSXAttribute' && node.name.name === 'style'
    && node.value?.expression?.type === 'ObjectExpression') {
    for (const property of node.value.expression.properties) {
      const key = property.key?.name || property.key?.value || '';
      if (!/color|background|border|shadow|outline|fill|stroke/i.test(key)) continue;
      if (property.value?.type === 'StringLiteral') checkValue(file, property.loc.start.line, property.value.value);
      // Expressions that choose actual product swatches retain their colours.
      if (property.value?.type === 'TemplateLiteral') property.value.quasis.forEach(part => checkValue(file, part.loc.start.line, part.value.raw));
    }
  }
  for (const [key, child] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(child)) child.forEach(item => inspectNode(item, file));
    else if (child && typeof child === 'object') inspectNode(child, file);
  }
}

const sourceFiles = walk(path.join(root, 'src'));
for (const file of sourceFiles.filter(file => file.endsWith('.css'))) {
  const source = fs.readFileSync(file, 'utf8');
  collectReferences(file, source);
  postcss.parse(source, { from: file }).walkDecls(declaration => {
    if (declaration.prop.startsWith('--')) customProperties.add(declaration.prop);
    if (declaration.prop.startsWith('--site-')) declared.add(declaration.prop);
    valueParser(declaration.value).walk(node => {
      if (node.type === 'function' && node.value === 'var') {
        const key = node.nodes[0]?.value;
        if (key && !key.startsWith('--site-') && node.nodes.length > 1)
          legacyReferences.push({ file, line:declaration.source.start.line, key, fallback:valueParser.stringify(node.nodes.slice(1)) });
        return false;
      }
    });
    // The pre-provider baseline is the only static CSS palette.
    if (relative(file) === 'src/index.css' && declaration.parent.selector === ':root') return;
    if (/color|background|border|shadow|outline|fill|stroke|^--/.test(declaration.prop))
      checkValue(file, declaration.source.start.line, declaration.value);
  });
}
const builder = fs.readFileSync(path.join(root, 'src/config/websiteCustomization.js'), 'utf8');
for (const match of builder.matchAll(/['"](--site-[\w-]+)['"]\s*:/g)) declared.add(match[1]);
for (const status of ['success', 'danger', 'warning', 'info', 'violet']) {
  ['', '-soft', '-border'].forEach(suffix => declared.add(`--site-${status}${suffix}`));
  declared.add(`--site-on-${status}`);
}
for (const file of sourceFiles.filter(file => /\.[jt]sx?$/.test(file)
  && !/\.test\.|[\\/](config|utils|services|store)[\\/]/.test(file))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/['"](--[\w-]+)['"]\s*:/g)) customProperties.add(match[1]);
  collectReferences(file, source);
  inspectNode(parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] }), file);
}
const tailwindFile = path.join(root, 'tailwind.config.js');
const tailwind = fs.readFileSync(tailwindFile, 'utf8');
collectReferences(tailwindFile, tailwind);
// This config is the palette for named utilities, not a source of fixed UI colours.
for (const match of tailwind.matchAll(/['"]([^'"\r\n]+)['"]/g)) {
  if (/^#|rgba?\(|hsla?\(/.test(match[1]) && !match[1].includes('var(')) checkValue(tailwindFile, tailwind.slice(0, match.index).split('\n').length, match[1]);
}
for (const reference of references) if (!declared.has(reference.token)) report(reference.file, 1, `Undefined theme token ${reference.token}.`);
for (const reference of legacyReferences) if (!customProperties.has(reference.key)
  && !/^--(mantine|tw|radix)-/.test(reference.key)
  && /#[\da-f]{3,8}|\b(?:white|black|rgba?|hsla?)\b/i.test(reference.fallback))
  report(reference.file, reference.line, `Undefined colour alias ${reference.key} falls back to a fixed colour.`);
if (issues.length) {
  console.error([...new Set(issues)].join('\n'));
  process.exitCode = 1;
} else console.log(`Theme check passed: ${sourceFiles.filter(file => file.endsWith('.css')).length} stylesheets and application components use declared theme colours.`);
