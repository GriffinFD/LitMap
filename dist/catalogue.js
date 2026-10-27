export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const normalize = value => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export function filterPlaces(catalogue, query = '', chapterId = 'all') {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return catalogue.places.filter(place => {
    const haystack = normalize([place.name, place.city, place.region, place.type, ...place.aliases].join(' '));
    const chapters = [...place.demoChapterIds, ...catalogue.mentions.filter(m => m.placeId === place.id && m.verification.status === 'verified').map(m => m.chapterId)];
    return words.every(word => haystack.includes(word)) && (chapterId === 'all' || chapters.includes(chapterId));
  });
}
export function streetViewUrl(place, apiKey = '') {
  const [lng, lat] = place.geography.geometry.coordinates;
  const view = place.streetView;
  if (!apiKey) {
    const params = new URLSearchParams({api:'1', map_action:'pano', viewpoint:`${lat},${lng}`});
    if (view.panoramaId) params.set('pano', view.panoramaId);
    return `https://www.google.com/maps/@?${params}`;
  }
  const params = new URLSearchParams({key:apiKey, pitch:String(view.pitch), fov:String(view.fov), source:'outdoor'});
  if (view.mode === 'panorama' && view.panoramaId) params.set('pano', view.panoramaId);
  else { params.set('location', `${lat},${lng}`); params.set('radius', String(view.radiusMeters)); }
  if (view.heading !== null) params.set('heading', String(view.heading));
  return `https://www.google.com/maps/embed/v1/streetview?${params}`;
}
// Store Google's exact Share > Embed URL; never generate its opaque `pb` payload.
export function isGoogleStreetViewEmbedUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.google.com' && url.pathname === '/maps/embed' &&
      !url.username && !url.password && !url.hash && Boolean(url.searchParams.get('pb'));
  } catch { return false; }
}
export function streetViewEmbedUrl(place, apiKey = '') {
  if (isGoogleStreetViewEmbedUrl(place.streetView?.embedUrl)) return place.streetView.embedUrl;
  return apiKey.trim() ? streetViewUrl(place, apiKey.trim()) : null;
}
export function validateCatalogue(data) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const tables = ['places','mentions','chapters','editions','sources'];
  const ids = {};
  for (const table of tables) {
    require(Array.isArray(data[table]), `${table}: must be an array`);
    if (!Array.isArray(data[table])) return errors;
    ids[table] = new Set();
    for (const row of data[table]) {
      require(typeof row.id === 'string' && /^[a-z0-9-]+$/.test(row.id), `${table}: invalid id`);
      require(!ids[table].has(row.id), `${table}: duplicate id ${row.id}`);
      ids[table].add(row.id);
    }
  }
  for (const source of data.sources) require(/^https:\/\//.test(source.url) || (source.url === null && ['textual','bibliographic'].includes(source.kind) && Boolean(source.note?.trim())), `${source.id}: source requires HTTPS URL or a documented offline text`);
  for (const ch of data.chapters) require(ids.sources.has(ch.sourceId), `${ch.id}: missing contents source`);
  for (const place of data.places) {
    const coords = place.geography?.geometry?.coordinates;
    require(coords?.length === 2 && Number.isFinite(coords[0]) && Math.abs(coords[0]) <= 180 && Number.isFinite(coords[1]) && Math.abs(coords[1]) <= 90, `${place.id}: invalid GeoJSON coordinates`);
    require(['exact','approximate','representative','area','unknown'].includes(place.geography?.precision), `${place.id}: invalid precision`);
    require(place.geography?.sourceIds?.length > 0, `${place.id}: coordinate source required`);
    for (const id of place.geography?.sourceIds ?? []) require(ids.sources.has(id), `${place.id}: missing source ${id}`);
    for (const id of place.demoChapterIds ?? []) require(ids.chapters.has(id), `${place.id}: missing demo chapter ${id}`);
    for (const id of place.mentionIds ?? []) require(data.mentions.some(m => m.id === id && m.placeId === place.id), `${place.id}: missing or mismatched mention ${id}`);
    require(place.geography?.uncertaintyMeters === null || (Number.isFinite(place.geography?.uncertaintyMeters) && place.geography.uncertaintyMeters >= 0), `${place.id}: invalid uncertainty`);
    if (place.status === 'verified') {
      require(place.demoChapterIds?.length === 0, `${place.id}: verified places cannot use demo chapter links`);
      require(data.mentions.some(m => m.placeId === place.id && m.verification.status === 'verified'), `${place.id}: verified place requires verified book evidence`);
    }
    require(place.streetView?.mode !== 'panorama' || Boolean(place.streetView?.panoramaId), `${place.id}: panorama mode needs a panorama ID`);
    require(!place.streetView?.embedUrl || isGoogleStreetViewEmbedUrl(place.streetView.embedUrl), `${place.id}: invalid Google Street View embed URL`);
  }
  for (const mention of data.mentions) {
    require(ids.places.has(mention.placeId), `${mention.id}: missing place`);
    require(data.places.find(p => p.id === mention.placeId)?.mentionIds.includes(mention.id), `${mention.id}: missing reciprocal place link`);
    require(mention.chapterId === null || ids.chapters.has(mention.chapterId), `${mention.id}: missing chapter`);
    for (const citation of mention.citations ?? []) require(ids.editions.has(citation.editionId), `${mention.id}: citation missing edition`);
    for (const id of mention.sourceIds ?? []) require(ids.sources.has(id), `${mention.id}: missing source`);
    if (mention.verification?.status === 'verified') {
      require(Boolean(mention.excerpt?.text?.trim()), `${mention.id}: verified quotation cannot be empty`);
      require(ids.chapters.has(mention.chapterId), `${mention.id}: verified quotation needs chapter`);
      require(mention.citations?.length > 0, `${mention.id}: verified quotation needs edition citation`);
      // Excerpt verification is independent of the owner's optional explanation.
      require(mention.explanation === null || typeof mention.explanation === 'string', `${mention.id}: explanation must be text or null`);
      require(mention.citations?.every(c => c.pages?.trim() || c.locator?.trim()), `${mention.id}: verified quotation needs a page or locator`);
      require(mention.sourceIds?.length > 0, `${mention.id}: verified quotation needs evidence source`);
      require(Boolean(mention.verification.reviewedBy && mention.verification.reviewedAt), `${mention.id}: verified quotation needs reviewer and date`);
    }
  }
  return errors;
}
