// merge-manifest.js <env>
// env: dev | prod
// 以 manifest.json 為 base，套用 manifest.<env>.patch.json
// patch value 為 null → 移除該 key
const env     = process.argv[2];
const path    = require('path');
const fs      = require('fs');

const rootDir = path.resolve(__dirname, '..');
const devDir  = __dirname;

const base  = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'),                'utf8'));
const patch = JSON.parse(fs.readFileSync(path.join(devDir,  `manifest.${env}.patch.json`),  'utf8'));

const result = { ...base };
for (const [key, value] of Object.entries(patch)) {
  if (value === null) {
    delete result[key];
  } else {
    result[key] = value;
  }
}

fs.writeFileSync(
  path.join(rootDir, 'manifest.json'),
  JSON.stringify(result, null, 2),
  'utf8'
);
