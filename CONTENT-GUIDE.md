# Place data and content standards

MappingJacobs is a visual companion to the book. This document describes how to keep its content accurate and maintainable.

## Collections

- `book`: work identity and original publication year.
- `editions`: publisher, year, ISBN and edition description; pagination belongs to a specific edition.
- `chapters`: the 22 numbered chapter titles, with a source for the table of contents.
- `sources`: stable IDs, URLs (null for documented offline books), access dates, type and source notes.
- `places`: names, aliases, city/region/country, feature type, geography, linked mentions and contemporary viewer configuration.
- `mentions`: a short excerpt at one place, a chapter, edition-specific citations, original explanation and verification status. One place may have several mentions.

## Geographic precision

GeoJSON coordinates use **[longitude, latitude]** in WGS84 decimal degrees. The map adapter reverses them for Leaflet. A representative point is not a boundary or a verified passage-specific address. `exact`, `approximate`, `representative`, `area` and `unknown` distinguish these cases. The historical match is recorded separately. Unknown uncertainty is `null`, not zero. Only supply an error radius when supported by evidence.

Hudson Street is anchored at a sourced point for Jacobs’s former home, 555 Hudson Street. Streets, neighborhoods and parks use representative points, not reconstructed historical boundaries. Union Square’s source coordinate is unreferenced; this limitation remains explicit.

## Adding a passage

1. Identify the working edition. Use printed page numbers where available; distinguish these from PDF page indices.
2. Transcribe only the brief excerpt needed. Preserve wording and punctuation, and record omissions or transcription decisions.
3. Add an edition citation, chapter ID and source record. Missing information stays null.
4. Leave `explanation: null` until the project owner supplies their explanation. Quotation verification does not require an explanation.
5. Check the passage before setting its verification status to `verified`, recording a reviewer and date.
6. Link it through `place.mentionIds`. Remove provisional `demoChapterIds` before marking a place verified.

The current collection has 15 verified short excerpts. Page references use the supplied EPUB’s pagebreak labels, not e-reader screen numbers. Exact paragraph locators are retained. Unverified quotations stay out of the reader interface. Keep full books, private scans and lengthy copyrighted text outside the source and deployment.

## Street View

Street View references identify contemporary imagery. The optional `embedUrl` stores the exact iframe source offered by Google's Share → Embed control, without needing an API key. Only official Google embed URLs are accepted. Keep `panoramaId` for the external Google link when available. Capture month and review date are separate: `verifiedAt` means the contemporary view was visually checked, not that the place's connection to the book has been verified. Leave uncertain dates null and explain discrepancies in `note`. Never present contemporary imagery as a depiction of 1961. See `STREET-VIEW.md`; do not download imagery.

## Expansion

The current release scope is 15 locations selected for their importance to Jacobs's arguments. The current selection has been checked against the working edition. Stable IDs and separate collections remain capable of more entries and several passages per place. Validate additions with `node scripts/check.mjs`. If collaborative editing eventually requires a database, the collections can map to relational tables while preserving the same public JSON structure.

## Working edition

Use the EPUB supplied by the project owner: Knopf Doubleday Publishing Group, 2016, ISBN 9780525432852 (`knopf-doubleday-epub-2016`). These bibliographic details come from its package metadata, which also lists source ISBN 9780679741954. The EPUB remains outside the website source and deployment. The embedded pagebreak labels have been checked for the selected excerpts. Reader-generated screen numbers are not these page labels; correspondence to other printed editions is not asserted.
