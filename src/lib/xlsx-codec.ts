import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;

export interface ParsedFirstSheet {
    sheetName: string;
    colWidths: number[];
    rows: unknown[][];
}

// eslint-disable-next-line no-control-regex
const ILLEGAL_XML_CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function escapeXml(value: string): string {
    return value
        .replace(ILLEGAL_XML_CONTROL_RE, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function unescapeXml(value: string): string {
    if (!value.includes('&') && !value.includes('_x')) return value;
    const unescaped = value.replace(
        /&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|quot|apos|amp);/g,
        (match, entity: string) => {
            if (entity === 'lt') return '<';
            if (entity === 'gt') return '>';
            if (entity === 'quot') return '"';
            if (entity === 'apos') return "'";
            if (entity === 'amp') return '&';
            if (entity.startsWith('#x')) {
                const cp = Number.parseInt(entity.slice(2), 16);
                return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff
                    ? String.fromCodePoint(cp)
                    : match;
            }
            if (entity.startsWith('#')) {
                const cp = Number.parseInt(entity.slice(1), 10);
                return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff
                    ? String.fromCodePoint(cp)
                    : match;
            }
            return match;
        },
    );
    return unescaped.replace(/_x([0-9A-Fa-f]{4})_/g, (match, hex: string) => {
        const cp = Number.parseInt(hex, 16);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    });
}

function sanitizeSheetName(name: string): string {
    const cleaned = name
        .replace(/[\\/*?:[\]]/g, '')
        .trim()
        .slice(0, 31);
    return cleaned || 'Sheet1';
}

function colIndexToLetters(index: number): string {
    let n = index + 1;
    let letters = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
}

function lettersToColIndex(letters: string): number {
    let index = 0;
    for (let i = 0; i < letters.length; i += 1) {
        const code = letters.charCodeAt(i);
        const upper = code >= 97 && code <= 122 ? code - 32 : code;
        if (upper < 65 || upper > 90) return -1;
        index = index * 26 + (upper - 64);
    }
    return index - 1;
}

function parseCellRefColIndex(cellRef: string): number {
    let end = 0;
    while (end < cellRef.length) {
        const code = cellRef.charCodeAt(end);
        const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
        if (!isLetter) break;
        end += 1;
    }
    if (end === 0) return -1;
    return lettersToColIndex(cellRef.slice(0, end));
}

function getAttr(attrs: string, name: string): string | null {
    // Linear attribute scan without nested quantifiers.
    let pos = 0;
    const len = attrs.length;
    while (pos < len) {
        while (pos < len && (attrs[pos] === ' ' || attrs[pos] === '\t' || attrs[pos] === '\n' || attrs[pos] === '\r')) {
            pos += 1;
        }
        const nameStart = pos;
        while (pos < len && attrs[pos] !== '=' && attrs[pos] !== ' ' && attrs[pos] !== '\t' && attrs[pos] !== '\n' && attrs[pos] !== '\r' && attrs[pos] !== '/') {
            pos += 1;
        }
        const attrName = attrs.slice(nameStart, pos);
        while (pos < len && (attrs[pos] === ' ' || attrs[pos] === '\t' || attrs[pos] === '\n' || attrs[pos] === '\r')) {
            pos += 1;
        }
        if (pos >= len || attrs[pos] !== '=') {
            pos += 1;
            continue;
        }
        pos += 1;
        while (pos < len && (attrs[pos] === ' ' || attrs[pos] === '\t' || attrs[pos] === '\n' || attrs[pos] === '\r')) {
            pos += 1;
        }
        const quote = attrs[pos];
        if (quote !== '"' && quote !== "'") {
            while (pos < len && attrs[pos] !== ' ' && attrs[pos] !== '\t') pos += 1;
            continue;
        }
        pos += 1;
        const valStart = pos;
        const valEnd = attrs.indexOf(quote, valStart);
        if (valEnd === -1) break;
        if (attrName === name || attrName.endsWith(`:${name}`)) {
            return unescapeXml(attrs.slice(valStart, valEnd));
        }
        pos = valEnd + 1;
    }
    return null;
}

function extractTextTags(xml: string): string {
    let result = '';
    let pos = 0;
    while (pos < xml.length) {
        const lt = xml.indexOf('<', pos);
        if (lt === -1) break;
        const gt = xml.indexOf('>', lt + 1);
        if (gt === -1) break;

        const tagContent = xml.slice(lt + 1, gt);
        if (tagContent.startsWith('/') || tagContent.startsWith('?') || tagContent.startsWith('!')) {
            pos = gt + 1;
            continue;
        }
        const isSelfClosing = tagContent.endsWith('/');
        const spaceIdx = tagContent.search(/[\s/]/);
        const fullTagName = spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx);
        const colonIdx = fullTagName.lastIndexOf(':');
        const localName = colonIdx === -1 ? fullTagName : fullTagName.slice(colonIdx + 1);

        if (localName === 't' && !isSelfClosing) {
            const closePrefix = `</${fullTagName}>`;
            const closeIdx = xml.indexOf(closePrefix, gt + 1);
            if (closeIdx === -1) break;
            result += unescapeXml(xml.slice(gt + 1, closeIdx));
            pos = closeIdx + closePrefix.length;
        } else {
            pos = gt + 1;
        }
    }
    return result;
}

function parseSharedStrings(xml: string): string[] {
    const strings: string[] = [];
    let pos = 0;
    while (pos < xml.length) {
        const lt = xml.indexOf('<', pos);
        if (lt === -1) break;
        const gt = xml.indexOf('>', lt + 1);
        if (gt === -1) break;
        const tag = xml.slice(lt + 1, gt);
        if (tag.startsWith('/') || tag.startsWith('?') || tag.startsWith('!')) {
            pos = gt + 1;
            continue;
        }
        const spaceIdx = tag.search(/[\s/]/);
        const fullName = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx);
        const colonIdx = fullName.lastIndexOf(':');
        const localName = colonIdx === -1 ? fullName : fullName.slice(colonIdx + 1);
        if (localName === 'si') {
            if (tag.endsWith('/')) {
                strings.push('');
                pos = gt + 1;
            } else {
                const closeTag = `</${fullName}>`;
                const closeIdx = xml.indexOf(closeTag, gt + 1);
                if (closeIdx === -1) break;
                strings.push(extractTextTags(xml.slice(gt + 1, closeIdx)));
                pos = closeIdx + closeTag.length;
            }
        } else {
            pos = gt + 1;
        }
    }
    return strings;
}

function parseWorkbookFirstSheetMeta(workbookXml: string): { name: string; rId: string | null } | null {
    let pos = 0;
    while (pos < workbookXml.length) {
        const lt = workbookXml.indexOf('<', pos);
        if (lt === -1) break;
        const gt = workbookXml.indexOf('>', lt + 1);
        if (gt === -1) break;
        const tag = workbookXml.slice(lt + 1, gt);
        if (!tag.startsWith('/') && !tag.startsWith('?') && !tag.startsWith('!')) {
            const spaceIdx = tag.search(/[\s/]/);
            const fullName = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx);
            const colonIdx = fullName.lastIndexOf(':');
            const localName = colonIdx === -1 ? fullName : fullName.slice(colonIdx + 1);
            if (localName === 'sheet') {
                const attrs = spaceIdx === -1 ? '' : tag.slice(spaceIdx);
                const name = getAttr(attrs, 'name') ?? 'Sheet1';
                const rId = getAttr(attrs, 'id');
                return { name, rId };
            }
        }
        pos = gt + 1;
    }
    return null;
}

function parseWorkbookRels(relsXml: string): Map<string, string> {
    const map = new Map<string, string>();
    let pos = 0;
    while (pos < relsXml.length) {
        const lt = relsXml.indexOf('<', pos);
        if (lt === -1) break;
        const gt = relsXml.indexOf('>', lt + 1);
        if (gt === -1) break;
        const tag = relsXml.slice(lt + 1, gt);
        if (!tag.startsWith('/') && !tag.startsWith('?') && !tag.startsWith('!')) {
            const spaceIdx = tag.search(/[\s/]/);
            const fullName = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx);
            const colonIdx = fullName.lastIndexOf(':');
            const localName = colonIdx === -1 ? fullName : fullName.slice(colonIdx + 1);
            if (localName === 'Relationship') {
                const attrs = spaceIdx === -1 ? '' : tag.slice(spaceIdx);
                const id = getAttr(attrs, 'Id');
                const target = getAttr(attrs, 'Target');
                if (id && target) {
                    map.set(id, target);
                }
            }
        }
        pos = gt + 1;
    }
    return map;
}

function resolveSheetPath(target: string | undefined): string {
    if (!target) return 'xl/worksheets/sheet1.xml';
    const normalized = target.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.toLowerCase().startsWith('xl/')) return normalized;
    return `xl/${normalized.replace(/^\.\//, '')}`;
}

function extractFirstSubTagText(xml: string, targetLocalName: string): string | null {
    let pos = 0;
    while (pos < xml.length) {
        const lt = xml.indexOf('<', pos);
        if (lt === -1) break;
        const gt = xml.indexOf('>', lt + 1);
        if (gt === -1) break;
        const tag = xml.slice(lt + 1, gt);
        if (tag.startsWith('/') || tag.startsWith('?') || tag.startsWith('!')) {
            pos = gt + 1;
            continue;
        }
        const spaceIdx = tag.search(/[\s/]/);
        const fullName = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx);
        const colonIdx = fullName.lastIndexOf(':');
        const localName = colonIdx === -1 ? fullName : fullName.slice(colonIdx + 1);
        if (localName === targetLocalName) {
            if (tag.endsWith('/')) return '';
            const closeTag = `</${fullName}>`;
            const closeIdx = xml.indexOf(closeTag, gt + 1);
            if (closeIdx === -1) return null;
            return xml.slice(gt + 1, closeIdx);
        }
        pos = gt + 1;
    }
    return null;
}

function parseCellValue(cellType: string | null, cellBody: string, sharedStrings: readonly string[]): unknown {
    if (cellType === 'inlineStr') {
        return extractTextTags(cellBody);
    }
    const rawV = extractFirstSubTagText(cellBody, 'v');
    if (rawV === null) return null;
    const text = unescapeXml(rawV);
    if (cellType === 's') {
        const idx = Number.parseInt(text.trim(), 10);
        return Number.isFinite(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : '';
    }
    if (cellType === 'str' || cellType === 'e') {
        return text;
    }
    if (cellType === 'b') {
        const trimmed = text.trim().toLowerCase();
        return trimmed === '1' || trimmed === 'true';
    }
    if (text === '') return null;
    const num = Number(text);
    return Number.isFinite(num) ? num : text;
}

function parseWorksheetXml(sheetXml: string, sharedStrings: readonly string[]): { colWidths: number[]; rows: unknown[][] } {
    const colWidths: number[] = [];
    const rows: unknown[][] = [];

    // Parse column widths from <cols>...</cols> if present.
    let pos = 0;
    while (pos < sheetXml.length) {
        const lt = sheetXml.indexOf('<', pos);
        if (lt === -1) break;
        const gt = sheetXml.indexOf('>', lt + 1);
        if (gt === -1) break;
        const tag = sheetXml.slice(lt + 1, gt);
        if (!tag.startsWith('/') && !tag.startsWith('?') && !tag.startsWith('!')) {
            const spaceIdx = tag.search(/[\s/]/);
            const fullName = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx);
            const colonIdx = fullName.lastIndexOf(':');
            const localName = colonIdx === -1 ? fullName : fullName.slice(colonIdx + 1);

            if (localName === 'col') {
                const attrs = spaceIdx === -1 ? '' : tag.slice(spaceIdx);
                const widthStr = getAttr(attrs, 'width');
                const minStr = getAttr(attrs, 'min');
                const maxStr = getAttr(attrs, 'max');
                const width = widthStr !== null ? Number(widthStr) : Number.NaN;
                const minCol = minStr !== null ? Number.parseInt(minStr, 10) : colWidths.length + 1;
                const maxCol = maxStr !== null ? Number.parseInt(maxStr, 10) : minCol;
                if (Number.isFinite(width) && Number.isFinite(minCol) && Number.isFinite(maxCol) && minCol >= 1 && maxCol - minCol < 1000) {
                    for (let c = minCol; c <= maxCol; c += 1) {
                        colWidths[c - 1] = width;
                    }
                }
            } else if (localName === 'sheetData') {
                if (!tag.endsWith('/')) {
                    const closeTag = `</${fullName}>`;
                    const closeIdx = sheetXml.indexOf(closeTag, gt + 1);
                    if (closeIdx !== -1) {
                        parseSheetData(sheetXml.slice(gt + 1, closeIdx), sharedStrings, rows);
                        pos = closeIdx + closeTag.length;
                        continue;
                    }
                }
                break;
            }
        }
        pos = gt + 1;
    }

    return { colWidths, rows };
}

function parseSheetData(sheetDataXml: string, sharedStrings: readonly string[], rows: unknown[][]): void {
    let pos = 0;
    let lastRowNum = 0;

    while (pos < sheetDataXml.length) {
        const lt = sheetDataXml.indexOf('<', pos);
        if (lt === -1) break;
        const gt = sheetDataXml.indexOf('>', lt + 1);
        if (gt === -1) break;
        const tag = sheetDataXml.slice(lt + 1, gt);
        if (tag.startsWith('/') || tag.startsWith('?') || tag.startsWith('!')) {
            pos = gt + 1;
            continue;
        }
        const spaceIdx = tag.search(/[\s/]/);
        const fullName = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx);
        const colonIdx = fullName.lastIndexOf(':');
        const localName = colonIdx === -1 ? fullName : fullName.slice(colonIdx + 1);

        if (localName !== 'row') {
            pos = gt + 1;
            continue;
        }

        const attrs = spaceIdx === -1 ? '' : tag.slice(spaceIdx);
        const rAttr = getAttr(attrs, 'r');
        const parsedRowNum = rAttr !== null ? Number.parseInt(rAttr, 10) : Number.NaN;
        const rowNum = Number.isFinite(parsedRowNum) && parsedRowNum > lastRowNum ? parsedRowNum : lastRowNum + 1;

        while (lastRowNum + 1 < rowNum) {
            rows.push([]);
            lastRowNum += 1;
        }

        if (tag.endsWith('/')) {
            rows.push([]);
            lastRowNum = rowNum;
            pos = gt + 1;
            continue;
        }

        const closeTag = `</${fullName}>`;
        const closeIdx = sheetDataXml.indexOf(closeTag, gt + 1);
        if (closeIdx === -1) break;

        const rowBody = sheetDataXml.slice(gt + 1, closeIdx);
        rows.push(parseRowCells(rowBody, sharedStrings));
        lastRowNum = rowNum;
        pos = closeIdx + closeTag.length;
    }
}

function parseRowCells(rowBody: string, sharedStrings: readonly string[]): unknown[] {
    const cells: unknown[] = [];
    let pos = 0;
    let nextColIdx = 0;

    while (pos < rowBody.length) {
        const lt = rowBody.indexOf('<', pos);
        if (lt === -1) break;
        const gt = rowBody.indexOf('>', lt + 1);
        if (gt === -1) break;
        const tag = rowBody.slice(lt + 1, gt);
        if (tag.startsWith('/') || tag.startsWith('?') || tag.startsWith('!')) {
            pos = gt + 1;
            continue;
        }
        const spaceIdx = tag.search(/[\s/]/);
        const fullName = spaceIdx === -1 ? tag : tag.slice(0, spaceIdx);
        const colonIdx = fullName.lastIndexOf(':');
        const localName = colonIdx === -1 ? fullName : fullName.slice(colonIdx + 1);

        if (localName !== 'c') {
            pos = gt + 1;
            continue;
        }

        const attrs = spaceIdx === -1 ? '' : tag.slice(spaceIdx);
        const refAttr = getAttr(attrs, 'r');
        const parsedColIdx = refAttr !== null ? parseCellRefColIndex(refAttr) : -1;
        const colIdx = parsedColIdx >= 0 ? parsedColIdx : nextColIdx;
        const cellType = getAttr(attrs, 't');

        let cellValue: unknown = null;
        if (tag.endsWith('/')) {
            pos = gt + 1;
        } else {
            const closeTag = `</${fullName}>`;
            const closeIdx = rowBody.indexOf(closeTag, gt + 1);
            if (closeIdx === -1) break;
            cellValue = parseCellValue(cellType, rowBody.slice(gt + 1, closeIdx), sharedStrings);
            pos = closeIdx + closeTag.length;
        }

        while (cells.length < colIdx) {
            cells.push(null);
        }
        cells[colIdx] = cellValue;
        nextColIdx = colIdx + 1;
    }

    return cells;
}

export function readXlsxFirstSheet(bytes: Uint8Array): ParsedFirstSheet | null {
    if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        return null;
    }

    try {
        let totalUncompressed = 0;
        let entryCount = 0;

        const unzipped = unzipSync(bytes, {
            filter: (file) => {
                entryCount += 1;
                if (entryCount > MAX_ZIP_ENTRIES) {
                    throw new Error('Too many zip entries');
                }
                if (file.originalSize > MAX_UNCOMPRESSED_BYTES) {
                    throw new Error('Zip entry exceeds size limit');
                }
                totalUncompressed += file.originalSize;
                if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
                    throw new Error('Uncompressed archive exceeds size limit');
                }
                const lower = file.name.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
                return (
                    lower === 'xl/workbook.xml' ||
                    lower === 'xl/_rels/workbook.xml.rels' ||
                    lower === 'xl/sharedstrings.xml' ||
                    lower.startsWith('xl/worksheets/')
                );
            },
        });

        const entries = new Map<string, Uint8Array>();
        for (const [name, content] of Object.entries(unzipped)) {
            if (content.byteLength > MAX_UNCOMPRESSED_BYTES) return null;
            const normalized = name.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
            entries.set(normalized, content);
        }

        const workbookBytes = entries.get('xl/workbook.xml');
        if (!workbookBytes) return null;

        const workbookMeta = parseWorkbookFirstSheetMeta(strFromU8(workbookBytes));
        if (!workbookMeta) return null;

        const relsBytes = entries.get('xl/_rels/workbook.xml.rels');
        const rels = relsBytes ? parseWorkbookRels(strFromU8(relsBytes)) : new Map<string, string>();
        const target = workbookMeta.rId ? rels.get(workbookMeta.rId) : undefined;
        const sheetPath = resolveSheetPath(target).toLowerCase();

        const sheetBytes = entries.get(sheetPath);
        if (!sheetBytes) return null;

        const sharedStringsBytes = entries.get('xl/sharedstrings.xml');
        const sharedStrings = sharedStringsBytes ? parseSharedStrings(strFromU8(sharedStringsBytes)) : [];

        const { colWidths, rows } = parseWorksheetXml(strFromU8(sheetBytes), sharedStrings);
        return {
            sheetName: workbookMeta.name,
            colWidths,
            rows,
        };
    } catch {
        return null;
    }
}

export function writeXlsxBytes(
    table: unknown[][],
    sheetName: string = 'Sheet1',
    colWidths?: Array<{ wch: number }>,
): Uint8Array {
    const safeSheetName = sanitizeSheetName(sheetName);

    let colsXml = '';
    if (colWidths && colWidths.length > 0) {
        const colTags = colWidths
            .map((col, idx) => {
                const width = Number.isFinite(col.wch) && col.wch > 0 ? col.wch : 10;
                return `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
            })
            .join('');
        colsXml = `<cols>${colTags}</cols>`;
    }

    const rowXmlParts: string[] = [];
    for (let r = 0; r < table.length; r += 1) {
        const row = table[r] ?? [];
        const excelRow = r + 1;
        if (row.length === 0) {
            rowXmlParts.push(`<row r="${excelRow}"/>`);
            continue;
        }
        const cellParts: string[] = [];
        for (let c = 0; c < row.length; c += 1) {
            const val = row[c];
            if (val === null || val === undefined) continue;
            const ref = `${colIndexToLetters(c)}${excelRow}`;
            if (typeof val === 'number' && Number.isFinite(val)) {
                cellParts.push(`<c r="${ref}"><v>${val}</v></c>`);
            } else if (typeof val === 'boolean') {
                cellParts.push(`<c r="${ref}" t="b"><v>${val ? 1 : 0}</v></c>`);
            } else {
                const str = String(val);
                cellParts.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(str)}</t></is></c>`);
            }
        }
        if (cellParts.length === 0) {
            rowXmlParts.push(`<row r="${excelRow}"/>`);
        } else {
            rowXmlParts.push(`<row r="${excelRow}">${cellParts.join('')}</row>`);
        }
    }

    const contentTypesXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>';

    const rootRelsXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>';

    const workbookXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>';

    const workbookRelsXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>';

    const stylesXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        '</styleSheet>';

    const sheetXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        colsXml +
        `<sheetData>${rowXmlParts.join('')}</sheetData>` +
        '</worksheet>';

    return zipSync(
        {
            '[Content_Types].xml': strToU8(contentTypesXml),
            '_rels/.rels': strToU8(rootRelsXml),
            'xl/workbook.xml': strToU8(workbookXml),
            'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml),
            'xl/styles.xml': strToU8(stylesXml),
            'xl/worksheets/sheet1.xml': strToU8(sheetXml),
        },
        { level: 6 },
    );
}
