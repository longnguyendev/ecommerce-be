/**
 * Nhận diện các sản phẩm "tách theo màu" từ tên và gom thành nhóm.
 *
 * Các dạng tên gặp trong dữ liệu:
 *   "Fleur Bra - Đen"                 -> base "Fleur Bra",  màu "Đen"
 *   "Smash - Váy Hồng"                -> base "Smash Váy",  màu "Hồng"
 *   "Sculpt - Black (Đen) - Bra"      -> base "Sculpt Bra", màu "Đen"
 *   "Timeless Socks - ... - Trắng"    -> màu là đoạn cuối
 */

export interface ParsedName {
  base: string;
  color: string | null;
}

const TYPE_PREFIX = /^(Áo|Váy|Quần|Top|Skirts?|Bra|Leggings)\s+(.+)$/i;
// "Black (Đen)" -> chỉ coi là màu khi phần trước ngoặc là chữ Latin không dấu
const ENGLISH_VI_COLOR = /^[A-Za-z ]+\((.+)\)\s*$/;

function cleanColor(raw: string): string {
  const m = raw.match(/^.+\(([^()]+)\)\s*$/);
  const value = m ? m[1] : raw;
  // "Navy (Xanh Navy" (thiếu ngoặc đóng) -> "Navy"
  return value.replace(/\s*\([^)]*$/, '').trim();
}

export function parseProductName(name: string): ParsedName {
  const segs = name
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segs.length <= 1) return { base: name.trim(), color: null };

  if (segs.length === 2) {
    const m = segs[1].match(TYPE_PREFIX);
    if (m) {
      return { base: `${segs[0]} ${m[1]}`, color: cleanColor(m[2]) };
    }
    return { base: segs[0], color: cleanColor(segs[1]) };
  }

  // >= 3 đoạn
  if (ENGLISH_VI_COLOR.test(segs[1])) {
    return {
      base: [segs[0], ...segs.slice(2)].join(' '),
      color: cleanColor(segs[1]),
    };
  }
  return {
    base: segs.slice(0, -1).join(' '),
    color: cleanColor(segs[segs.length - 1]),
  };
}

export function normalizeKey(base: string): string {
  return base.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface GroupableProduct {
  id: string;
  name: string;
  categoryId: string;
  createdAt: Date;
}

export interface MergeGroup<T extends GroupableProduct> {
  base: string;
  members: { product: T; color: string }[];
  /** Màu trùng nhau trong nhóm -> bỏ qua, cần xử lý tay. */
  duplicateColors: string[];
}

export function groupProducts<T extends GroupableProduct>(
  products: T[],
): MergeGroup<T>[] {
  const map = new Map<string, MergeGroup<T>>();

  for (const product of products) {
    const { base, color } = parseProductName(product.name);
    if (!color) continue;
    const key = `${product.categoryId}::${normalizeKey(base)}`;
    let group = map.get(key);
    if (!group) {
      group = { base, members: [], duplicateColors: [] };
      map.set(key, group);
    }
    group.members.push({ product, color });
  }

  const groups: MergeGroup<T>[] = [];
  for (const group of map.values()) {
    if (group.members.length < 2) continue; // sản phẩm đơn lẻ: không gộp
    group.members.sort(
      (a, b) =>
        a.product.createdAt.getTime() - b.product.createdAt.getTime() ||
        a.product.name.localeCompare(b.product.name),
    );
    const seen = new Set<string>();
    for (const m of group.members) {
      const k = m.color.toLowerCase();
      if (seen.has(k)) group.duplicateColors.push(m.color);
      seen.add(k);
    }
    groups.push(group);
  }
  return groups.sort((a, b) => a.base.localeCompare(b.base));
}
