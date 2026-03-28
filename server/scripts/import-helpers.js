/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const normalizeHeader = (value = '') => String(value)
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const readCsvRows = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
};

const readExcelRows = (filePath, sheetName = null) => {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const xlsx = require('xlsx');
  const workbook = xlsx.readFile(filePath);
  const targetSheetName = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error(`Sheet "${targetSheetName}" not found in ${path.basename(filePath)}`);
  }
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
};

const readRows = (filePath, sheetName = null) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    return readExcelRows(filePath, sheetName);
  }
  return readCsvRows(filePath);
};

const splitList = (value, delimiter = ',') => String(value || '')
  .split(delimiter)
  .map((item) => item.trim())
  .filter(Boolean);

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
};

const parseNumber = (value, fallback = undefined) => {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pickHeaderValue = (row, prefix) => {
  const normalizedPrefix = normalizeHeader(prefix);
  const entry = Object.entries(row).find(([key]) => normalizeHeader(key).startsWith(normalizedPrefix));
  return entry ? entry[1] : '';
};

const parsePipeItems = (value, minParts) => splitList(value, ';')
  .map((item) => item.split('|').map((part) => part.trim()))
  .filter((parts) => parts.some(Boolean) && parts.length >= minParts);

module.exports = {
  parseArgs,
  readRows,
  splitList,
  parseBoolean,
  parseNumber,
  pickHeaderValue,
  parsePipeItems,
  escapeRegex,
};

