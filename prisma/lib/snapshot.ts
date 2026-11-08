/** Các bảng catalog được xuất/nhập (thứ tự = thứ tự nhập, đảo ngược khi xoá). */
export const SNAPSHOT_TABLES = [
  'category',
  'collection',
  'product',
  'productCollection',
  'attribute',
  'attributeValue',
  'productVariant',
  'variantAttributeValue',
  'productImage',
] as const;

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];
export type Snapshot = Record<SnapshotTable, Record<string, unknown>[]>;

export const SNAPSHOT_FILE = 'prisma/snapshot/catalog.json';

/** JSON không có kiểu Date: các cột *At được đọc lại thành Date khi nhập. */
export function reviveDates(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] =
      typeof value === 'string' && /At$/.test(key) ? new Date(value) : value;
  }
  return out;
}
