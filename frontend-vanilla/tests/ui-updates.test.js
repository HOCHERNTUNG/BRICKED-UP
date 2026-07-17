const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

test('auth screen includes password peek and no HCT branding', () => {
  const authJs = read('js/components/auth.js');
  assert.match(authJs, /password-peek-btn/i);
  assert.doesNotMatch(authJs, /HCT/i);
});

test('workspace listens for shortcut to toggle HCT pattern', () => {
  const appJs = read('js/app.js');
  assert.match(appJs, /toggleHctPattern\(\)/i);
  assert.match(appJs, /ctrlKey && event\.shiftKey && event\.key\.toLowerCase\(\) === 'h'/i);
});

test('inventory panel uses the renamed title and wider width', () => {
  const stateJs = read('js/hooks/state.js');
  assert.match(stateJs, /name:\s*'Inventory'/);
  assert.match(stateJs, /const inventoryW = 561/);
});
