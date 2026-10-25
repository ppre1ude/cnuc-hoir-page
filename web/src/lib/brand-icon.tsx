import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const mark = await readFile(join(process.cwd(), "public/images/choir-mark.png"), "base64");

export function brandIcon(size: number) {
  // 작은 아이콘에는 기존 심벌만 사용하며 원본 비율을 유지한다. 심벌 파일은 여백 없이 잘려 있어 좌우 6%씩 숨을 돌립니다.
  const width = size * .88;
  // eslint-disable-next-line @next/next/no-img-element -- 아이콘 렌더러에서는 next/image를 사용할 수 없다.
  const image = <img src={`data:image/png;base64,${mark}`} width={width} height={width * 1845 / 2775} alt="" />;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "white" }}>
      {image}
    </div>,
    { width: size, height: size },
  );
}
