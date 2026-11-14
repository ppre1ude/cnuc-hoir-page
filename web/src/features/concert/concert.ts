// 공개 연주회 안내에 쓰는 정보입니다. 합창단이 공식 채널에 올린 내용만 적고, 다음 연주회 때 이 파일만 고칩니다.
export const concert = {
  round: "제2회 정기연주회",
  title: "_____에게 보내는 편지",
  /** 공유 카드에서 제목 아래에 뜨는 한 줄. 카카오톡이 36자쯤에서 자르므로 그 안으로 씁니다. */
  invitation: "전남대학교 합창단의 제2회 정기연주회에 당신을 초대합니다.",
  /** 랜딩 안내 줄에 쓰는 짧은 날짜 */
  shortDate: "11. 20 (금) 19:00",
  dateLabel: "2026. 11. 20. (금) 19:00",
  doors: "18:30부터 입장",
  venue: "전남대학교 민주마루",
  mapUrl: "https://map.naver.com/p/search/전남대학교%20민주마루",
  admission: "전석 무료",
  conductors: "박찬영, 박예영",
  advisor: "방대진",
  /** 이 시각부터 '공연을 마쳤습니다'로 바꾸고 랜딩 안내 줄을 내립니다. 공연 다음 날 0시(한국 시간)입니다. */
  endsAt: "2026-11-21T00:00:00+09:00",
};

export function isConcertUpcoming(now: Date) {
  return now.getTime() < Date.parse(concert.endsAt);
}
