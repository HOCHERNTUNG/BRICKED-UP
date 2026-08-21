// build.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const srcDir = __dirname;
const destDir = path.join(srcDir, '..', 'frontend-vanilla-bundle');

console.log(`Starting build from: ${srcDir}`);
console.log(`Destination directory: ${destDir}`);

// 1. Clean destination directory
if (fs.existsSync(destDir)) {
  console.log('Cleaning old bundle directory...');
  fs.rmSync(destDir, { recursive: true, force: true });
}

// 2. Create directories
fs.mkdirSync(destDir, { recursive: true });
fs.mkdirSync(path.join(destDir, 'css'), { recursive: true });
fs.mkdirSync(path.join(destDir, 'js'), { recursive: true });
fs.mkdirSync(path.join(destDir, 'assets'), { recursive: true });
fs.mkdirSync(path.join(destDir, 'assets', 'builds'), { recursive: true });

// 3. Copy CSS files
const cssFiles = fs.readdirSync(path.join(srcDir, 'css'));
cssFiles.forEach(file => {
  fs.copyFileSync(
    path.join(srcDir, 'css', file),
    path.join(destDir, 'css', file)
  );
});
console.log('CSS files copied successfully.');

// 4. Copy Assets
const copyRecursive = (src, dest) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

copyRecursive(path.join(srcDir, 'assets'), path.join(destDir, 'assets'));
console.log('Assets directory copied successfully.');

// Copy favicon.png if exists
const faviconPath = path.join(srcDir, 'favicon.png');
if (fs.existsSync(faviconPath)) {
  fs.copyFileSync(faviconPath, path.join(destDir, 'favicon.png'));
}

// 5. Modify and copy index.html (remove type="module") - written AFTER the
//    bundle exists, so the cache-busting stamp can hash the real output.
let indexHtml = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
indexHtml = indexHtml.replace(/<script type="module" src="js\/app\.js[^"]*"><\/script>/i, '<script src="js/app.js"></script>');

// 6. Bundle JavaScript using esbuild
try {
  console.log('Bundling JavaScript with esbuild...');
  execSync('npx esbuild js/app.js --bundle --outfile=../frontend-vanilla-bundle/js/app.js --format=iife --platform=browser', {
    cwd: srcDir,
    stdio: 'inherit'
  });
  console.log('Bundling completed successfully!');
} catch (err) {
  console.error('Error during esbuild bundling:', err.message);
  process.exit(1);
}

// 7. Cache busting.
//
// index.html references css/*.css and js/app.js by bare path. Browsers cache
// those aggressively, and invalidating CloudFront only clears the CDN - a
// returning visitor keeps serving the old copy from local cache and sees a
// stale app after a deploy. Stamping each reference with a hash of the actual
// file content makes the URL change whenever the content does, so the browser
// is obliged to refetch, while unchanged files stay cached.
const stamp = (relPath) => {
  const full = path.join(destDir, relPath);
  if (!fs.existsSync(full)) return null;
  return crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex').slice(0, 10);
};

indexHtml = indexHtml.replace(/(href|src)="((?:css|js)\/[^"?]+)"/g, (match, attr, rel) => {
  const h = stamp(rel);
  return h ? `${attr}="${rel}?v=${h}"` : match;
});

fs.writeFileSync(path.join(destDir, 'index.html'), indexHtml, 'utf8');
console.log('index.html processed and written (assets cache-busted).');

// 8. Netlify (and any other static host) fallback.
//
// CloudFront is configured to answer 403/404 with index.html so a refresh or a
// deep link still loads the app. A plain static host does not do that by
// default, so the same bundle deployed to Netlify would 404 on anything that
// is not exactly "/". This file is Netlify's equivalent of that rule and is
// simply ignored by hosts that do not understand it.
fs.writeFileSync(path.join(destDir, '_redirects'), '/*  /index.html  200\n',
                 'utf8');
console.log('_redirects written for static-host fallback.');
console.log('Build completed! Files are in: ' + destDir);
