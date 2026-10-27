import assert from 'node:assert/strict';
import {validateCatalogue, streetViewEmbedUrl} from '../dist/catalogue.js';

const base = new URL(process.argv[2]);
if (!base.pathname.endsWith('/')) base.pathname += '/';
assert.ok(['https:', 'http:'].includes(base.protocol));
const expectedCommit = process.argv[3];

async function get(relative, type) {
  const url = new URL(relative, base);
  url.searchParams.set('verify', expectedCommit || Date.now().toString());
  const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200, `${relative}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).origin, base.origin, `${relative}: unexpected redirect`);
  assert.ok(response.headers.get('content-type')?.includes(type), `${relative}: wrong content type`);
  return response;
}

async function verify() {
  const html = await (await get('./', 'text/html')).text();
  assert.ok(html.includes('id="map"') && html.includes('id="chapter-nav"'), 'Not the LitMap page');
  const data = await (await get('data/catalogue.json', 'json')).json();
  assert.deepEqual(validateCatalogue(data), []);
  assert.ok(data.places.length >= 15);
  assert.ok(data.places.every(p => streetViewEmbedUrl(p)), 'A selected Street View embed is missing');
  for (const file of ['app.js','catalogue.js','config.js','vendor/leaflet.js','vendor/leaflet.markercluster.js']) {
    const response = await get(file, 'javascript');
    assert.ok((await response.text()).length > 30, `${file}: empty asset`);
  }
  for (const file of ['styles.css','vendor/leaflet.css','vendor/MarkerCluster.css']) await get(file, 'text/css');
  await get('icon.svg', 'image/svg+xml');
  if (expectedCommit) {
    const stamp = await (await get('deployment.json', 'json')).json();
    assert.equal(stamp.commit, expectedCommit, 'Published commit is stale');
  }
  console.log(`Public HTTP checks passed: ${data.places.length} places at ${base.href}`);
  console.log('These checks verify deployed assets and data; interactive browser QA is separate.');
}

for (let attempt = 1; attempt <= 6; attempt++) {
  try { await verify(); break; }
  catch (error) {
    if (attempt === 6) throw error;
    console.log(`Deployment not ready (attempt ${attempt}): ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
