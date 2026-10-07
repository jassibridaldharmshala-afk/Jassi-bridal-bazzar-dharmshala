const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const indexFile = path.join(buildDir, 'index.html');
const fallbackFile = path.join(buildDir, '404.html');

if (!fs.existsSync(indexFile)) process.exit(0);
fs.copyFileSync(indexFile, fallbackFile);
