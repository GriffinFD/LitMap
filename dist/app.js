import {config} from './config.js';
import {escapeHtml as e, filterPlaces, streetViewUrl, streetViewEmbedUrl, validateCatalogue} from './catalogue.js';

const $ = selector => document.querySelector(selector);
const mobile = matchMedia('(max-width:760px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const markers = new Map();
let data, map, clusters, precisionCircle;
let currentId = null, chapterId = 'all', visiblePlaces = [], selectionOrigin = null;
let welcomeDismissed = false;
const numbering = place => String(data.places.indexOf(place) + 1).padStart(2, '0');
const chapterLabel = id => {
  const chapter = data.chapters.find(chapter => chapter.id === id);
  return chapter ? `${String(chapter.number).padStart(2, '0')} · ${chapter.title}` : 'Unassigned';
};

for (const button of document.querySelectorAll('[data-dialog]')) {
  button.addEventListener('click', () => {
    if (mobile.matches && $('#chapter-sidebar').classList.contains('is-open')) setSidebar(false);
    document.getElementById(button.dataset.dialog).showModal();
  });
}
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
$('#about-dialog').addEventListener('click', event => {
  if (event.target !== event.currentTarget) return;
  const box = event.currentTarget.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.currentTarget.close();
});

async function init() {
  try {
    const response = await fetch(new URL('./data/catalogue.json', import.meta.url));
    if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
    data = await response.json();
    const errors = validateCatalogue(data);
    if (errors.length) throw new Error(errors.join('; '));
    renderChapters();
    initializeMap();
    restoreState();
    $('#search').addEventListener('input', () => {
      hideWelcome();
      closeDetail(false, false);
      updateResults();
    });
    $('#clear-filters').addEventListener('click', clearFilters);
    $('#empty-reset').addEventListener('click', clearFilters);
    $('#reset-map').addEventListener('click', () => fitMap());
    $('#dismiss-welcome').addEventListener('click', () => { hideWelcome(); $('#map').focus({preventScroll:true}); });
    $('#toggle-chapters').addEventListener('click', () => setSidebar(!$('#chapter-sidebar').classList.contains('is-open')));
    $('#close-chapters').addEventListener('click', () => setSidebar(false));
    $('#sidebar-scrim').addEventListener('click', () => setSidebar(false));
    window.addEventListener('hashchange', () => { if (!['#map','#explorer'].includes(location.hash)) restoreState(); });
    mobile.addEventListener('change', () => { setSidebar(false, false); map?.invalidateSize({pan:false}); });
    document.addEventListener('keydown', onKeydown);
    setSidebar(false, false);
  } catch (error) {
    console.error(error);
    $('#result-count').textContent = 'Places unavailable';
    showMapError('The places could not load. Please reload the page or open the place data from About.');
  }
}

function renderChapters() {
  const parts = new Map([[2,'PART I · CITY LIFE'],[7,'PART II · URBAN DIVERSITY'],[13,'PART III · DECLINE & RENEWAL'],[17,'PART IV · APPROACHES TO CHANGE']]);
  $('#chapter-nav').innerHTML = `<button type="button" class="chapter-button chapter-all" data-chapter="all" aria-pressed="true"><span class="chapter-number" aria-hidden="true">◎</span><span class="chapter-name">All chapters</span><span class="chapter-count">${data.places.length}</span></button>` + data.chapters.map(chapter => `${parts.has(chapter.number) ? `<p class="part-heading">${parts.get(chapter.number)}</p>` : ''}<button type="button" class="chapter-button" data-chapter="${e(chapter.id)}" aria-pressed="false" aria-label="Chapter ${chapter.number}: ${e(chapter.title)}"><span class="chapter-number">${String(chapter.number).padStart(2,'0')}</span><span class="chapter-name">${e(chapter.title)}</span><span class="chapter-count" aria-label="${filterPlaces(data,'',chapter.id).length} mapped places">${filterPlaces(data,'',chapter.id).length}</span></button>`).join('');
  for (const button of document.querySelectorAll('[data-chapter]')) button.addEventListener('click', () => {
    chapterId = button.dataset.chapter;
    $('#search').value = '';
    hideWelcome();
    closeDetail(false, false);
    updateResults();
    if (mobile.matches) setSidebar(false);
  });
}

function initializeMap() {
  if (!window.L) { showMapError('The map could not load. Use the chapter sidebar and place list to explore the entries.'); return; }
  map = L.map('map', {zoomControl:false, minZoom:2, maxZoom:config.tileMaxZoom, zoomSnap:.1, zoomDelta:1, worldCopyJump:true, scrollWheelZoom:true}).setView([40,-97],4);
  L.control.zoom({position:'bottomright'}).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  const tiles = L.tileLayer(config.tileUrl, {attribution:config.tileAttribution, maxZoom:config.tileMaxZoom}).addTo(map);
  let failures = 0;
  tiles.on('tileerror', () => { if (++failures >= 3) showMapError('Some map tiles are unavailable. Markers and the place list remain usable.'); });
  tiles.on('loading', () => { failures = 0; });
  tiles.on('load', () => { if (!failures) $('#map-error').hidden = true; });
  clusters = L.markerClusterGroup ? L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:38,animate:!reducedMotion,iconCreateFunction:group => L.divIcon({className:'atlas-marker cluster',html:`<span class="pin" aria-label="${group.getChildCount()} places">${group.getChildCount()}</span>`,iconSize:[38,38],iconAnchor:[19,19]})}) : L.layerGroup();
  clusters.addTo(map);
  for (const place of data.places) {
    const [lng,lat] = place.geography.geometry.coordinates;
    const marker = L.marker([lat,lng], {icon:makeIcon(place),title:`${place.name}, ${place.city}`,alt:`Explore ${place.name}`,keyboard:true,autoPanOnFocus:false});
    marker.bindTooltip(`${e(place.name)} · ${e(place.city)}`, {direction:'top',offset:[0,-17]});
    marker.on('click', () => selectPlace(place.id, false, 'marker'));
    markers.set(place.id, marker);
  }
  map.on('click', () => { $('#search-results').hidden = true; });
  new ResizeObserver(() => map.invalidateSize({pan:false})).observe($('#map'));
}

function makeIcon(place) {
  return L.divIcon({className:'atlas-marker',html:`<span class="pin ${currentId === place.id ? 'selected' : ''}">${numbering(place)}</span>`,iconSize:[33,33],iconAnchor:[16,16]});
}
function updateMarkerStyles() { if (map) for (const place of data.places) markers.get(place.id).setIcon(makeIcon(place)); }
function showMapError(message) { $('#map-error').hidden = false; $('#map-error').textContent = message; }
function hideWelcome() { welcomeDismissed = true; $('#welcome').hidden = true; }
function saveState() {
  const params = new URLSearchParams();
  if (currentId) params.set('place', currentId);
  if ($('#search').value) params.set('q', $('#search').value);
  if (chapterId !== 'all') params.set('chapter', chapterId);
  history.replaceState(null, '', `${location.pathname}${location.search}${params.size ? '#'+params : ''}`);
}
function restoreState() {
  const params = new URLSearchParams(location.hash.slice(1));
  $('#search').value = params.get('q') || '';
  chapterId = data.chapters.some(chapter => chapter.id === params.get('chapter')) ? params.get('chapter') : 'all';
  closeDetail(false, false);
  updateResults(false);
  const selected = params.get('place');
  if (visiblePlaces.some(place => place.id === selected)) selectPlace(selected, true, null);
  $('#welcome').hidden = welcomeDismissed || Boolean(selected) || chapterId !== 'all' || Boolean($('#search').value);
}
function clearFilters() {
  chapterId = 'all';
  $('#search').value = '';
  closeDetail(false, false);
  updateResults();
}
function updateResults(sync = true) {
  visiblePlaces = filterPlaces(data, $('#search').value, chapterId);
  $('#result-count').textContent = `${visiblePlaces.length} ${visiblePlaces.length === 1 ? 'place' : 'places'}`;
  $('#total-count').textContent = visiblePlaces.length;
  $('#current-chapter-label').textContent = chapterId === 'all' ? 'All chapters' : `Chapter ${data.chapters.find(chapter => chapter.id === chapterId).number}`;
  $('#clear-filters').hidden = !$('#search').value && chapterId === 'all';
  for (const button of document.querySelectorAll('[data-chapter]')) button.setAttribute('aria-pressed', String(button.dataset.chapter === chapterId));
  renderList();
  $('#empty-state').hidden = visiblePlaces.length > 0;
  if (!visiblePlaces.length) {
    $('#empty-title').textContent = $('#search').value ? 'No matching places' : 'No places mapped yet';
    $('#empty-copy').textContent = $('#search').value ? 'Try another place name or city, or clear the filters to see all available entries.' : 'Entries for this chapter have not been added to the companion yet. Choose another chapter or return to all places.';
  }
  if (map) {
    clusters.clearLayers();
    for (const place of visiblePlaces) clusters.addLayer(markers.get(place.id));
    updateMarkerStyles();
    fitMap();
  }
  if (sync) saveState();
}
function placeButton(place) {
  return `<button type="button" class="place-card" data-place="${e(place.id)}" aria-pressed="${currentId === place.id}" aria-controls="detail"><span class="place-number">${numbering(place)}</span><span><span class="place-name">${e(place.name)}</span><span class="place-city">${e(place.city)}, ${e(place.region)}</span></span></button>`;
}
function renderList() {
  const list = visiblePlaces.map(placeButton).join('');
  $('#place-list').innerHTML = list || '<p class="empty-search">No places in this view.</p>';
  $('#search-results').innerHTML = list;
  $('#search-results').hidden = !$('#search').value || !visiblePlaces.length || Boolean(currentId);
  for (const button of document.querySelectorAll('[data-place]')) button.addEventListener('click', () => selectPlace(button.dataset.place,true,'list'));
}
function fitMap() {
  if (!map || !visiblePlaces.length) return;
  const bounds = L.latLngBounds(visiblePlaces.map(place => {const [lng,lat] = place.geography.geometry.coordinates; return [lat,lng];}));
  const top = mobile.matches ? 90 : 80;
  map.fitBounds(bounds, {paddingTopLeft:[mobile.matches ? 28 : 55,top],paddingBottomRight:[mobile.matches ? 28 : 55,65],maxZoom:visiblePlaces.length === 1 ? 14 : 16,animate:false});
}
function selectPlace(id, zoom = false, origin = null) {
  const place = data.places.find(place => place.id === id);
  if (!place) return;
  currentId = id;
  selectionOrigin = origin;
  hideWelcome();
  if (mobile.matches) setSidebar(false, false);
  renderList();
  renderDetail(place);
  updateMarkerStyles();
  if (map) {
    if (precisionCircle) map.removeLayer(precisionCircle);
    const [lng,lat] = place.geography.geometry.coordinates;
    if (place.geography.uncertaintyMeters > 0) precisionCircle = L.circle([lat,lng],{radius:place.geography.uncertaintyMeters,color:'#a64d36',weight:1,fillOpacity:.08,dashArray:'4 5'}).addTo(map);
    if (zoom) map.setView([lat,lng],place.type === 'neighborhood' ? 13 : 15,{animate:false});
    // Keep the selected point visible beside the overlay, without resizing the map.
    const point = map.latLngToContainerPoint([lat,lng]);
    const size = map.getSize();
    if (mobile.matches) {
      const available = size.y - $('#detail').offsetHeight;
      if (point.y > available-35 || point.y < 75) map.panBy([0, point.y-Math.max(95,available/2)],{animate:false});
    } else if (point.x > size.x - $('#detail').offsetWidth - 60) {
      map.panBy([point.x - (size.x - $('#detail').offsetWidth)/2, 0],{animate:false});
    }
  }
  saveState();
  if (origin) $('#detail-title').focus({preventScroll:true});
}
function closeDetail(restoreFocus = true, sync = true) {
  const previousId = currentId;
  currentId = null;
  $('#detail').hidden = true;
  $('#detail').classList.remove('is-expanded');
  $('.map-panel').classList.remove('has-detail', 'sheet-expanded');
  $('#detail').replaceChildren();
  if (map && precisionCircle) { map.removeLayer(precisionCircle); precisionCircle = null; }
  if (data) { updateMarkerStyles(); renderList(); }
  if (sync) saveState();
  if (restoreFocus) {
    const marker = selectionOrigin === 'marker' && markers.get(previousId)?.getElement();
    const list = !mobile.matches && $('#place-index').open && [...document.querySelectorAll('#place-list [data-place]')].find(button => button.dataset.place === previousId);
    (marker || list || $('#map')).focus({preventScroll:true});
  }
}
function setSidebar(open, focus = true) {
  const active = mobile.matches && open;
  $('#chapter-sidebar').classList.toggle('is-open', active);
  $('#chapter-sidebar').inert = mobile.matches && !active;
  $('#toggle-chapters').setAttribute('aria-expanded',String(active));
  $('#sidebar-scrim').hidden = !active;
  $('.map-panel').inert = active;
  $('.masthead').inert = active;
  if (active) {
    $('#chapter-sidebar').setAttribute('role','dialog');
    $('#chapter-sidebar').setAttribute('aria-modal','true');
  } else {
    $('#chapter-sidebar').removeAttribute('role');
    $('#chapter-sidebar').removeAttribute('aria-modal');
  }
  if (focus && mobile.matches) (active ? $('#close-chapters') : $('#toggle-chapters')).focus({preventScroll:true});
}
function onKeydown(event) {
  if ($('#about-dialog').open) return;
  if (mobile.matches && $('#chapter-sidebar').classList.contains('is-open')) {
    if (event.key === 'Escape') { event.preventDefault(); setSidebar(false); }
    if (event.key === 'Tab') {
      const elements = [...$('#chapter-sidebar').querySelectorAll('button, summary, a')].filter(element => element.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
    }
  } else if (event.key === 'Escape' && currentId) { event.preventDefault(); closeDetail(); }
}
function renderDetail(place) {
  const mentions = data.mentions.filter(mention => mention.placeId === place.id && mention.verification.status === 'verified');
  const [lng,lat] = place.geography.geometry.coordinates;
  const country = new Intl.DisplayNames(['en'],{type:'region'}).of(place.country);
  const embedUrl = streetViewEmbedUrl(place, config.googleMapsEmbedApiKey);
  $('#detail').hidden = false;
  $('.map-panel').classList.add('has-detail');
  $('.map-panel').classList.remove('sheet-expanded');
  $('#detail').classList.remove('is-expanded');
  $('#detail').innerHTML = `<div class="sheet-controls"><button type="button" id="expand-detail" class="sheet-expand" aria-label="Expand place details" aria-expanded="false"><span aria-hidden="true"></span></button></div>
  <div class="detail-head"><div class="detail-topline"><span class="micro">PLACE ${numbering(place)} · ${e(place.type.toUpperCase())}</span><button id="close-detail" type="button" class="icon-button" aria-label="Close place details">×</button></div><span class="status-tag">${place.status === 'demonstration' ? 'SAMPLE ENTRY · NOT VERIFIED' : place.status === 'verified' ? 'EXCERPT CHECKED' : e(place.status.toUpperCase())}</span><h2 id="detail-title" tabindex="-1">${e(place.name)}</h2><p class="detail-location">${e(place.city)}, ${e(place.region)} · ${e(country)}</p></div>
  <div class="detail-body">
  <section class="detail-section"><h3>Contemporary Street View</h3><div id="street-view">${embedUrl ? '' : '<div class="view-placeholder"><p>A panorama has not been selected for this place yet. Explore available imagery using the link below.</p></div>'}</div><a class="street-link" href="${e(streetViewUrl(place))}" target="_blank" rel="noopener noreferrer">Open Google Street View <span aria-hidden="true">↗</span></a><p class="street-caption">Contemporary imagery, not a view of 1961. ${place.streetView.captureDate ? `Image captured ${e(place.streetView.captureDate)}. ` : 'Check the capture date in Google’s viewer. '}${place.streetView.verifiedAt ? `Panorama checked ${e(place.streetView.verifiedAt)}; this does not verify its match to a passage in the book.` : 'Coverage and camera position are unverified.'} If the viewer is unavailable, use the Google link above.</p></section>
  <section class="detail-section"><h3>From the book <span>${mentions.length ? 'CHECKED AGAINST EPUB' : 'EXCERPT PENDING'}</span></h3>${mentions.length ? mentions.map(renderMention).join('') : `<div class="quote-placeholder"><p>An excerpt has not yet been added. Quotations and page references will be checked against the chosen edition.</p></div><p class="reference-line"><strong>Sample chapter:</strong> ${place.demoChapterIds.map(chapterLabel).map(e).join('; ') || 'Unassigned'}<br>Chapter association unverified · Page pending</p>`}</section>
  ${!mentions.length ? `<section class="detail-section"><h3>Why this place matters</h3><p class="body-copy">${e(place.editorialNote)}</p></section>` : ''}
  <section class="detail-section"><details><summary>POSITION & SOURCE NOTES</summary><div class="source-item"><span class="coordinate">${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}</span><p>${e(place.geography.note)}</p><p>Precision: ${e(place.geography.precision)}. Historical match: ${e(place.geography.historicalMatch)}. Uncertainty radius: ${place.geography.uncertaintyMeters === null ? 'not established' : e(place.geography.uncertaintyMeters)+' m'}.</p></div>${place.geography.sourceIds.map(id => {const source = data.sources.find(source => source.id === id);return `<div class="source-item"><a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)} ↗</a><p>${e(source.note)}</p><p>Accessed ${e(source.accessedAt)}</p></div>`;}).join('')}<p class="street-caption">${e(place.streetView.note)}</p></details></section></div>`;
  $('#close-detail').addEventListener('click', () => closeDetail());
  $('#expand-detail').addEventListener('click', () => {
    const expanded = $('#detail').classList.toggle('is-expanded');
    $('.map-panel').classList.toggle('sheet-expanded', expanded);
    $('#expand-detail').setAttribute('aria-expanded', String(expanded));
    $('#expand-detail').setAttribute('aria-label',expanded ? 'Collapse place details' : 'Expand place details');
  });
  if (embedUrl) {
    const frame = document.createElement('iframe');
    frame.className = 'street-frame';
    frame.title = `Contemporary Google Street View near ${place.name}`;
    frame.src = embedUrl;
    frame.allowFullscreen = true;
    frame.loading = 'eager';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    $('#street-view').replaceChildren(frame);
  }
}
function renderMention(mention) {
  const references = mention.citations.map(citation => {
    const edition = data.editions.find(edition => edition.id === citation.editionId);
    return `<p class="reference-line">${citation.pages ? `<strong>EPUB page${citation.pages.includes('–') ? 's' : ''} ${e(citation.pages)}</strong><br>` : ''}${e(edition.publisher)}, ${edition.year}</p><details class="citation-notes"><summary>Edition & passage location</summary><p>${e(edition.description)}</p>${citation.locator ? `<p class="epub-locator">${e(citation.locator)}</p>` : ''}<p>${e(citation.note)}</p><p>${e(mention.excerpt.transcriptionNote)}</p></details>`;
  }).join('');
  return `<article class="passage"><blockquote>${e(mention.excerpt.text)}</blockquote><p class="reference-line">Jane Jacobs · Chapter ${e(chapterLabel(mention.chapterId))}</p>${references}<h3 class="explanation-heading">Why this place matters</h3>${mention.explanation ? `<p class="body-copy">${e(mention.explanation)}</p>` : '<p class="explanation-pending">Explanation forthcoming.</p>'}</article>`;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
