import { brandIcon } from "../lib/brand-icon";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return brandIcon(size.width);
}
