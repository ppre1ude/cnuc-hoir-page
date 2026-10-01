import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "전남대학교 합창단 로고";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo = await readFile(join(process.cwd(), "public/images/choir-logo-horizontal.png"), "base64");

export default function OpenGraphImage() {
  // 공유 카드 렌더러는 일반 이미지 요소를 사용하며 기존 로고의 비율을 유지한다.
  // eslint-disable-next-line @next/next/no-img-element -- 공유 이미지 렌더러에서는 next/image를 사용할 수 없다.
  const image = <img src={`data:image/png;base64,${logo}`} width={1040} height={1040 * 1696 / 7855} alt={alt} />;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "white" }}>
      {image}
    </div>,
    size,
  );
}
