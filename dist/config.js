// Public browser configuration. A Google browser key is not a server secret:
// restrict it to Maps Embed API and your approved website origins in Google Cloud.
export const config = Object.freeze({
  googleMapsEmbedApiKey: '',
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  tileMaxZoom: 19
});
