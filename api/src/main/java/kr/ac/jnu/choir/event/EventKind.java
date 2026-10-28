package kr.ac.jnu.choir.event;

// 일정 종류입니다. 정기연습과 비정기연습은 전체 단원 연습이고, 파트연습만 파트를 하나 가집니다.
// EVENT는 화면에서 "중요 행사"(연주회, 발표회, MT 등)라고 부릅니다.
public enum EventKind {
    REGULAR_REHEARSAL, EXTRA_REHEARSAL, PART_REHEARSAL, EVENT
}
