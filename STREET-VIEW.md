# Configuring contemporary Street View

For the first collection of 15 places, use Google's selected panorama embeds. No API key or Google Cloud setup is needed for these URLs.

1. Open the place in Google Maps and enter Street View. Visually check the street signs, buildings and map position. A nearby or user-contributed panorama may be misplaced; coordinates alone do not verify the image.
2. Choose a helpful angle. Prefer Google's street imagery when available; clearly identify contributor panoramas in the data note.
3. Use **Share → Embed a map** (or **Share or embed image**). Copy the `src` URL from Google's iframe into `streetView.embedUrl`. Store the URL only, never raw iframe HTML. Do not invent or edit the opaque `pb` payload.
4. Record the observed panorama ID in `panoramaId` and set `mode` to `panorama` for a matching external Google link. Record the capture month in `captureDate` only when clear, and the day checked in `verifiedAt`. Describe the view and any uncertainty in `note`.
5. Run `node scripts/check.mjs`, open the location panel and confirm the panorama loads without another click. Check that imagery, attribution, camera movement and full-screen controls work on desktop and mobile.

The app creates an iframe automatically when a location panel opens, sends only the site's origin as the referrer, and leaves an external Google link available. Cross-origin iframe restrictions prevent the app from reliably detecting Google's internal error screens; visually review the actual panorama. Recheck selected views before release and if Google replaces or removes imagery.

Adding or reviewing an embed never verifies a book excerpt, chapter association or historical location. Those retain their separate source and review fields.

## Optional API fallback

For a location without `embedUrl`, `dist/config.js` can supply `googleMapsEmbedApiKey`. Enable Maps Embed API in your Google Cloud project, restrict the key to that API, and allow only the deployment origin and necessary local preview origins. Do not put server credentials in the browser configuration. API-key restrictions and any Google Cloud account or billing setup are managed by the project owner.

References: [Google's sharing and embedding instructions](https://support.google.com/maps/answer/7101463?hl=en), [Maps Embed API](https://developers.google.com/maps/documentation/embed/embedding-map).
