const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.resolve(process.cwd(), 'dist-api');
if (!fs.existsSync(outputDir)) {
  process.exit(0);
}

fs.writeFileSync(
  path.join(outputDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
  'utf8',
);

console.log('Wrote dist-api/package.json with type=commonjs');
