import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterPlaces,streetViewUrl,streetViewEmbedUrl,isGoogleStreetViewEmbedUrl,validateCatalogue,escapeHtml} from '../dist/catalogue.js';
const data=JSON.parse(readFileSync(new URL('../dist/data/catalogue.json',import.meta.url),'utf8'));
test('fifteen checked passages can await the owner’s explanations',()=>{assert.equal(data.places.length,15);assert.equal(data.mentions.length,15);assert.ok(data.places.every(p=>p.status==='verified'&&p.demoChapterIds.length===0&&p.mentionIds.length===1));assert.ok(data.mentions.every(m=>m.explanation===null&&m.verification.status==='verified'&&m.citations[0].pages&&m.citations[0].locator));assert.deepEqual(validateCatalogue(data),[]);});
test('search combines city, aliases, case, accents and chapter constraints',()=>{assert.equal(filterPlaces(data,'PHÍLLY','ch05')[0].id,'rittenhouse-square');assert.equal(filterPlaces(data,'North Boston')[0].id,'north-end');assert.equal(filterPlaces(data,'Boston','ch05').length,0);assert.equal(filterPlaces(data,'','ch05').length,2);assert.equal(filterPlaces(data,'missing').length,0);});
test('bad coordinates and dangling sources cannot pass validation',()=>{const bad=structuredClone(data);bad.places[0].geography.geometry.coordinates=[-181,91];bad.places[0].geography.sourceIds=['missing'];assert.ok(validateCatalogue(bad).some(e=>e.includes('coordinates')));assert.ok(validateCatalogue(bad).some(e=>e.includes('missing source')));});
test('a demo cannot silently become a verified record',()=>{const bad=structuredClone(data);bad.places[0].status='verified';bad.places[0].demoChapterIds=['ch02'];bad.mentions=[];const errors=validateCatalogue(bad);assert.ok(errors.some(e=>e.includes('demo chapter')));assert.ok(errors.some(e=>e.includes('book evidence')));});
test('verified excerpts require edition, reviewer, chapter and evidence',()=>{const bad=structuredClone(data);bad.places[0].mentionIds=['sample'];bad.mentions=[{id:'sample',placeId:bad.places[0].id,chapterId:null,excerpt:{text:null},citations:[],sourceIds:[],explanation:null,verification:{status:'verified'}}];assert.ok(validateCatalogue(bad).length>=5);});
test('Street View uses official Google endpoints, panorama IDs and latitude-longitude order',()=>{
  const p=structuredClone(data.places[1]);
  const link=new URL(streetViewUrl(p));
  assert.equal(link.searchParams.get('viewpoint'),'39.9492795,-75.1724005');
  assert.equal(link.searchParams.get('api'),'1');
  assert.equal(link.searchParams.get('key'),null);
  assert.equal(link.searchParams.get('pano'),p.streetView.panoramaId);
  const panorama=new URL(streetViewUrl(p,'test-key'));
  assert.equal(panorama.searchParams.get('pano'),p.streetView.panoramaId);
  p.streetView.mode='location'; p.streetView.panoramaId=null;
  const embed=new URL(streetViewUrl(p,'test-key'));
  assert.equal(embed.origin,'https://www.google.com');
  assert.equal(embed.pathname,'/maps/embed/v1/streetview');
  assert.equal(embed.searchParams.get('key'),'test-key');
  assert.equal(embed.searchParams.get('location'),'39.9492795,-75.1724005');
});
test('imported editorial text cannot become executable markup',()=>{assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');});

test('selected Google embeds work without a key and take precedence over the API',()=>{
  const place=structuredClone(data.places[0]);
  place.streetView.embedUrl='https://www.google.com/maps/embed?pb=opaque-google-payload';
  assert.equal(streetViewEmbedUrl(place),place.streetView.embedUrl);
  assert.equal(streetViewEmbedUrl(place,'optional-key'),place.streetView.embedUrl);
  delete place.streetView.embedUrl;
  assert.equal(streetViewEmbedUrl(place),null);
  assert.equal(new URL(streetViewEmbedUrl(place,' optional-key ')).searchParams.get('key'),'optional-key');
});

test('untrusted iframe URLs and HTML cannot become embedded content',()=>{
  for(const url of ['javascript:alert(1)','https://www.google.com.evil.test/maps/embed?pb=x','https://evil.test/maps/embed?pb=x','https://www.google.com/maps/embed?pb=','https://user:password@www.google.com/maps/embed?pb=x','<iframe src="https://www.google.com/maps/embed?pb=x"></iframe>']) {
    assert.equal(isGoogleStreetViewEmbedUrl(url),false);
    const bad=structuredClone(data); bad.places[0].streetView.embedUrl=url;
    assert.ok(validateCatalogue(bad).some(error=>error.includes('embed URL')));
    assert.equal(streetViewEmbedUrl(bad.places[0]),null);
  }
});

test('offline book sources need provenance and verified citations need a locator',()=>{
 const bad=structuredClone(data);const source=bad.sources.find(s=>s.id==='working-epub-2016');source.note='';
 assert.ok(validateCatalogue(bad).some(e=>e.includes('documented offline text')));
 const missing=structuredClone(data);missing.mentions[0].citations[0].pages=null;missing.mentions[0].citations[0].locator=null;
 assert.ok(validateCatalogue(missing).some(e=>e.includes('page or locator')));
});
test('chapter filtering follows checked passages and restores all fifteen',()=>{
 assert.equal(filterPlaces(data,'','all').length,15);
 assert.deepEqual(filterPlaces(data,'','ch08').map(p=>p.id),['carnegie-hall','oakland']);
 assert.equal(filterPlaces(data,'','ch04').length,0);
 for(const m of data.mentions) assert.ok(filterPlaces(data,'',m.chapterId).some(p=>p.id===m.placeId));
});
