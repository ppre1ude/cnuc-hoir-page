package kr.ac.jnu.choir.auth;

// 설계 문서의 권한 표 한 줄이 한 항목입니다. 서버는 이 값으로 요청을 검사하고, 화면은 이 값으로 메뉴를 가립니다.
public enum Permission {
    MANAGE_SITE_ADMINS,          // 사이트 관리자·단장·부단장 지정, 사이트 관리자 등록 명단
    MANAGE_ROLES,                // 그 밖의 직책 부여·해제, 파트·기수 수정
    REVOKE_ACCESS,               // 접근 해제
    MANAGE_ALLOWLIST,            // 자동 승인 명단
    APPROVE_APPLICATIONS,        // 가입 승인·반려, 1회용 링크 발급
    MANAGE_FULL_REHEARSALS,      // 전체연습 개최·수정
    MANAGE_PART_REHEARSALS,      // 모든 파트의 파트연습 개최·수정
    MANAGE_PART_ATTENDANCE,      // 모든 파트의 파트연습 응답 집계와 출석 관리
    MANAGE_EVENTS,               // 행사·공지 등록·수정, 출석 창과 정정
    WRITE_MINUTES,               // 회의록 쓰기·고치기
    DELETE_MINUTES,              // 회의록 삭제
    VIEW_MEMBERS,                // 회원 목록 보기
    VIEW_MINUTES                 // 회의록 보기
}
