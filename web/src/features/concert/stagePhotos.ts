import type { Still } from "./stills";

// 제2회 정기연주회 날 찍은 사진입니다. 원본은 너무 무거워 격자용(thumb)과 크게 보기용(view) 두 크기로 줄여 Supabase 공개 보관함에 올려 두었습니다.
// 파일 이름은 촬영 순서대로 붙인 번호(001.webp ~ 236.webp)이고, 원본은 단원만 자료실의 드라이브 링크로 받습니다.
const base = "https://mwpbchhhkxoievvtjtay.supabase.co/storage/v1/object/public/concert-photos/2";

// 번호순으로 가로(L)인지 세로(P)인지 적었습니다. 사진이 모두 3:2라 방향만 알면 크기가 정해집니다.
const orientation = "LPLLLLPPLLLLLLLPPPPPPLLPPLLPPPPPPPPPLPPPPPPPLPLLLPPPPPPPPPPPPPPPPPPPPLLLLLLLLLLLPPPPLLLLPPPPPPPPPPPPPPPPPPPPPLLLLLPPPPPPPPPPPPPPPPPPPLLLLLPPPPPPPLLLLLPPPPPPPLLLLLLLLLLPPPPLLLLLLLPPPPPPPPPPPLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL";

// 내릴 사진의 번호를 적으면 갤러리 격자에서 빠집니다. 주소로도 열리지 않게 하려면 보관함의 thumb, view 파일도 지웁니다.
// 195(첫 화면 무대), 19와 46(축사와 인사말)은 갤러리 페이지가 따로 쓰므로, 격자에서 빼더라도 보관함의 파일은 남겨 둡니다.
const removed = new Set<number>([]);

/** 번호로 사진 한 장을 만듭니다. 격자에서 내린 사진도 번호로는 꺼낼 수 있습니다. */
export function stagePhoto(n: number): Still {
  const file = `${String(n).padStart(3, "0")}.webp`;
  const [width, height] = orientation[n - 1] === "L" ? [1600, 1067] : [1067, 1600];
  return { src: `${base}/view/${file}`, thumb: `${base}/thumb/${file}`, alt: `제2회 정기연주회 공연 사진 ${n}`, width, height };
}

export const stagePhotos: Still[] = Array.from(orientation, (_, i) => i + 1).filter((n) => !removed.has(n)).map(stagePhoto);
