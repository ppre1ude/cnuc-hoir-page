export type ActivityPhoto = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
};

// 공개 메인의 '합창'·'걸어온 길' 장면에 쓰는 무대 사진입니다. 확인되지 않은 촬영 날짜나 공연명은 붙이지 않습니다.
export const stagePhoto: ActivityPhoto = {
  id: "performance",
  src: "/images/choir-performance.jpg",
  alt: "지휘자와 단원들이 무대에서 합창하는 모습",
  width: 2880,
  height: 2160,
};
