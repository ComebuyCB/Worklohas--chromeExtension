// merge-manifest.js <env>
// env: dev | prod
const env  = process.argv[2];
const path = require('path');
const fs   = require('fs');

const devDir  = __dirname;
const rootDir = path.resolve(devDir, '..');

const base  = JSON.parse(fs.readFileSync(path.join(devDir, 'manifest.base.json'),          'utf8'));
const patch = JSON.parse(fs.readFileSync(path.join(devDir, `manifest.${env}.patch.json`),  'utf8'));

fs.writeFileSync(
  path.join(rootDir, 'manifest.json'),
  JSON.stringify(Object.assign(base, patch), null, 2),
  'utf8'
);
