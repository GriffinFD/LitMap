"""Verify short catalogue excerpts against a locally supplied EPUB, without copying it.

Usage: python scripts/verify-epub.py PATH_TO_EPUB
Uses only the Python standard library. Page references are EPUB pagebreak labels.
"""
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

catalogue = json.loads((Path(__file__).resolve().parents[1] / 'dist/data/catalogue.json').read_text(encoding='utf-8'))
epub_type = '{http://www.idpf.org/2007/ops}type'


def read_paragraph(document, target):
    root = ET.fromstring(document)
    chars, pages, anchors = [], [], {}
    page = None

    def append(text):
        chars.extend(text or '')
        pages.extend([page] * len(text or ''))

    def walk(element):
        nonlocal page
        if 'pagebreak' in element.get(epub_type, '').split():
            page = element.get('title')
        start = len(chars)
        append(element.text)
        for child in element:
            walk(child)
            append(child.tail)
        if element.get('id'):
            anchors[element.get('id')] = (start, len(chars))

    walk(root)
    start, end = anchors[target]
    raw = ''.join(chars[start:end])
    raw_pages = pages[start:end]
    text, mapping = '', []
    for word in re.finditer(r'\S+', raw):
        if text:
            text += ' '
            mapping.append(raw_pages[word.start()])
        text += word.group()
        mapping.extend(raw_pages[word.start():word.end()])
    return text, mapping


if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/verify-epub.py PATH_TO_EPUB')
with ZipFile(sys.argv[1]) as book:
    for mention in catalogue['mentions']:
        citation = mention['citations'][0]
        filename, anchor = citation['locator'].split('#', 1)
        chapter = int(mention['chapterId'][2:])
        assert f'_c{chapter:02}_' in filename, f'{mention["id"]}: chapter mismatch'
        paragraph, mapping = read_paragraph(book.read(filename), anchor)
        excerpt = mention['excerpt']['text']
        assert excerpt in paragraph, f'{mention["id"]}: text mismatch'
        start = paragraph.index(excerpt)
        labels = list(dict.fromkeys(mapping[start:start+len(excerpt)]))
        assert labels and all(labels), f'{mention["id"]}: missing page labels'
        expected = labels[0] if len(labels) == 1 else labels[0] + '\u2013' + labels[-1]
        assert citation['pages'] == expected, f'{mention["id"]}: page mismatch'
        print(f'OK {mention["placeId"]}: chapter {chapter}, EPUB pages {expected}')
print(f'Verified {len(catalogue["mentions"])} exact excerpts, chapter files, paragraph anchors and page labels.')
