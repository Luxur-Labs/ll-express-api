export const ORDER_IMPORT_UPDATE_COLUMN_KEYS = [
  'createdDate',
  'estimateDate',
  'schedule',
  'status',
  'partner',
  'reference',
  'patientName',
  'patientAge',
  'patientGender',
  'toothNumber',
] as const;

export type OrderImportUpdateColumn = (typeof ORDER_IMPORT_UPDATE_COLUMN_KEYS)[number];

export const ORDER_IMPORT_UPDATE_COLUMNS: {
  key: OrderImportUpdateColumn;
  header: string;
  label: string;
}[] = [
  { key: 'createdDate', header: 'Date', label: 'Created Date' },
  { key: 'estimateDate', header: 'Expected Date', label: 'Expected Date' },
  { key: 'schedule', header: 'Delivery Date', label: 'Delivery Date' },
  { key: 'status', header: 'Case Status', label: 'Case Status' },
  { key: 'partner', header: 'Partner', label: 'Partner' },
  { key: 'reference', header: 'Reference', label: 'Reference' },
  { key: 'patientName', header: 'Patient Name', label: 'Patient Name' },
  { key: 'patientAge', header: 'Patient Age', label: 'Patient Age' },
  { key: 'patientGender', header: 'Patient Gender', label: 'Patient Gender' },
  { key: 'toothNumber', header: 'Tooth number', label: 'Tooth number' },
];

const KEY_SET = new Set<string>(ORDER_IMPORT_UPDATE_COLUMN_KEYS);

export function parseOrderImportUpdateColumns(raw: unknown): OrderImportUpdateColumn[] {
  if (raw == null || raw === '') return [];
  const parts = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : String(raw).split(',');
  const seen = new Set<OrderImportUpdateColumn>();
  for (const part of parts) {
    const key = part.trim() as OrderImportUpdateColumn;
    if (KEY_SET.has(key)) seen.add(key);
  }
  return [...seen];
}

export function orderImportUpdateColumnLabels(columns: string[]): string {
  const byKey = new Map(ORDER_IMPORT_UPDATE_COLUMNS.map((c) => [c.key, c.label]));
  return columns.map((key) => byKey.get(key as OrderImportUpdateColumn) ?? key).join(', ');
}
