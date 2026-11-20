import JSZip from 'jszip';

export type Row = Record<string, string | number | null | undefined>;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

const csvCell = (v: any) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCSV(rows: Row[], cols?: string[]): string {
  const c = cols || (rows[0] ? Object.keys(rows[0]) : []);
  return [c.map(csvCell).join(','), ...rows.map(r => c.map(k => csvCell(r[k])).join(','))].join('\r\n');
}
export function exportCSV(rows: Row[], name: string, cols?: string[]) {
  download(new Blob(['﻿' + toCSV(rows, cols)], { type: 'text/csv;charset=utf-8' }), name);
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function colName(i: number) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

/** Builds a real .xlsx workbook in the browser (no server, no external library besides JSZip). */
export async function buildXLSX(sheets: { name: string; rows: Row[]; cols?: string[] }[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  sheets.forEach((s, i) => {
    const cols = s.cols || (s.rows[0] ? Object.keys(s.rows[0]) : []);
    const cell = (v: any, r: number, c: number, style = 0) => {
      const ref = `${colName(c)}${r}`;
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(v == null ? '' : String(v))}</t></is></c>`;
    };
    const rowsXml = [`<row r="1">${cols.map((c, ci) => cell(c, 1, ci, 1)).join('')}</row>`,
      ...s.rows.map((row, ri) => `<row r="${ri + 2}">${cols.map((c, ci) => cell(row[c], ri + 2, ci)).join('')}</row>`)].join('');
    const widths = cols.map((c, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${Math.min(45, Math.max(10, c.length + 4, ...s.rows.slice(0, 50).map(r => String(r[c] ?? '').length + 2)))}" customWidth="1"/>`).join('');
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols.length ? `<cols>${widths}</cols>` : ''}<sheetData>${rowsXml}</sheetData></worksheet>`);
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export async function exportXLSX(rows: Row[], name: string, sheet = 'Report', cols?: string[]) {
  download(await buildXLSX([{ name: sheet, rows, cols }]), name);
}

// ---- Import parsing (CSV + XLSX, entirely in the browser) ----
export function parseCSV(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.some(c => c.trim() !== ''));
}

export async function parseXLSX(buf: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buf);
  const parser = new DOMParser();
  const shared: string[] = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) {
    const doc = parser.parseFromString(await ss.async('string'), 'application/xml');
    Array.from(doc.getElementsByTagName('si')).forEach(si => shared.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent || '').join('')));
  }
  const sheetFile = zip.file('xl/worksheets/sheet1.xml') || zip.file(/xl\/worksheets\/sheet\d+\.xml/)[0];
  if (!sheetFile) throw new Error('No worksheet found');
  const doc = parser.parseFromString(await sheetFile.async('string'), 'application/xml');
  const rows: string[][] = [];
  Array.from(doc.getElementsByTagName('row')).forEach(r => {
    const vals: string[] = [];
    Array.from(r.getElementsByTagName('c')).forEach(c => {
      const ref = c.getAttribute('r') || '';
      const letters = ref.replace(/\d+/g, '');
      let idx = 0; for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64); idx--;
      const t = c.getAttribute('t');
      let v = '';
      if (t === 's') v = shared[Number(c.getElementsByTagName('v')[0]?.textContent || 0)] || '';
      else if (t === 'inlineStr') v = Array.from(c.getElementsByTagName('t')).map(x => x.textContent || '').join('');
      else v = c.getElementsByTagName('v')[0]?.textContent || '';
      vals[idx < 0 ? vals.length : idx] = v;
    });
    rows.push(Array.from(vals, v => v ?? ''));
  });
  return rows.filter(r => r.some(c => (c || '').trim() !== ''));
}

export function downloadBlob(blob: Blob, name: string) { download(blob, name); }
