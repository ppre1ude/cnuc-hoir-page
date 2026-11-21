# 화면 조립 틀 설계

작성일: 2026-11-05. 대상: `web/src/components/ui`에 더하는 조립 부품과 공용 CSS, 운영진 다섯 화면과 일정 상세를 비롯한 내부 화면의 CSS 정리, `/design-system` 미리보기, `docs/design-system.md`의 공통 컴포넌트 절.

## 왜 바꾸는가

버튼, 입력, 상태 배지, 알림 문구, 페이지 제목은 모든 화면이 `components/ui`의 공용 부품을 쓴다. 그래서 단원 화면은 대체로 고르게 보인다. 그런데 그 위층, 즉 페이지 틀, 섹션 소제목, 패널(테두리 카드), 목록의 한 줄, 폼 배치, 도움말 문구, 사실 표, 뒤로 가기 링크는 기능 CSS마다 따로 정의한다.

- `features/member/AdminPages.module.css` 한 파일에 운영진용 클래스가 40개 넘게 있고, 일정 편집, 일정 달력, 공지 목록, 내 출석 CSS가 각자 `.page`, `.list`, `.row`, `.form`, `.hint`를 다시 정의한다.
- 값이 조금씩 다르다. 소제목 아래 여백이 운영진 화면은 0, 일정 편집은 16px이다. 목록 한 줄의 높이와 안쪽 여백도 화면마다 다르다. 폼의 라벨과 입력 사이 여백을 어떤 파일은 라벨 위에, 어떤 파일은 입력 아래에 둔다.
- 일정 상세(`/events/[id]`)는 달력용 CSS의 `.card`를 빌려 쓰고, 소제목 옆 배지, 바닥의 맨 링크처럼 다른 화면에 없는 배치를 쓴다.

그 결과 운영진 화면이 제각각이고, 집행부원은 화면마다 다른 모양을 익혀야 한다. 2026-11-05 사용자는 운영진 화면과 단원 화면 모두 겉모습이 바뀌어도 된다고 했다.

목표는 조립 틀을 공용 부품으로 뽑아 내부 화면 전부가 같은 틀을 쓰게 하고, 기능 CSS에는 그 기능만의 배치만 남기는 것이다. 토큰과 작은 부품은 그대로 둔다.

## 목표와 하지 않는 것

목표

- 아래 조립 부품 아홉 개를 `components/ui`에 더하고, 운영진과 단원의 내부 화면 전부가 그것을 쓴다.
- 기능 CSS에서 페이지, 섹션, 패널, 목록, 행, 폼, 도움말, 사실 표, 뒤로 가기 정의를 지운다. 남는 것은 달력 격자, QR, 투표 선택지, 참석 버튼 쌍처럼 그 기능만의 배치다.
- `/design-system`에 새 부품을 전시한다.
- `docs/design-system.md`의 공통 컴포넌트 절에 부품을 더하고, 적용 검증 기록을 한 건 남긴다.

하지 않는 것

- 토큰 값, 색, 글꼴을 바꾸지 않는다. 패키지를 더하지 않는다. Tailwind 같은 도구로 바꾸지 않는다. 다크 모드를 만들지 않는다.
- 공개 메인(`SandLanding`)과 인증 화면(`(auth)/layout`)은 손대지 않는다. 공개 메인은 따로 승인된 구성이고, 인증 화면은 이미 공통 틀을 쓴다.
- 데이터, API, 동작, 권한을 바꾸지 않는다. 화면 문구는 틀을 바꾸는 데 꼭 필요한 것만 바꾼다.
- 새 기능을 넣지 않는다. 자유게시판과 명예단원 가입은 다음 일이다.

이렇게 되면 실패다

- 390px에서 가로로 넘치거나, 손가락으로 누르는 요소가 44px보다 작아진다.
- 라벨과 입력의 연결, `role`, 초점 표시, 보조 낭독 안내가 빠진다.
- 테두리와 상자가 지금보다 늘어 화면이 더 복잡해진다. 패널은 한 화면에 한 겹이다. 패널 안에 패널을 두지 않는다.
- 기존 웹 테스트가 검증하던 동작이 깨진다. 구조가 바뀌면 테스트도 같이 고치되 동작 검증은 유지한다.

## 결정한 것

### 조립 부품

모두 `web/src/components/ui`에 둔다. 컴포넌트는 `index.tsx`, CSS는 `ui.module.css`가 기본이고, 파일이 길어지면 `layout.tsx`와 `layout.module.css`로 나눠도 된다. 값은 전부 `tokens.css`의 토큰이다.

| 부품 | 역할 | 모양 규칙 | 지금 대체하는 것 |
| --- | --- | --- | --- |
| `Section` | 소제목 한 덩어리. 제목(h2), 제목 옆 상태 배지, 오른쪽 동작, 설명 한 줄, 내용 | 위 여백 32px, 페이지나 패널의 첫 섹션은 0. 제목은 21px, 굵기 750, `--tracking-heading`, 아래 16px. 제목 줄은 가로 배치로 배지는 제목 바로 옆, 동작은 오른쪽 끝. 760px 이하에서는 줄바꿈. 설명은 14px 흐린 글자 | `.section h2`, `.page h2`, `.memberSection h2`, `.rowHeader`, `.panel > h2`, `.form > h2` |
| `Panel` | 테두리 카드. 폼과 상세를 담는다 | 기존 `.surface` 그대로. 안쪽 24px, 모바일 20px, 1px `--color-line`, `--radius-panel`. 패널 안 섹션 사이는 1px 구분선과 위아래 24px | `.panel`, `.card`, `.detail`, `.eventPageCard` |
| `List` | 구분선 목록 | 굵은 윗선 2px `--color-ink`. 패널 안에서는 윗선 없음. `ul`이면 점과 안쪽 여백 제거 | `.list`, `.rosterList`, `.pendingList`, 내 출석 `.list` |
| `Row` | 목록 한 줄. 두 가지. 내용 행은 제목, 보조 문구, 동작을 담는다. 선택 행은 줄 전체가 링크나 버튼이다 | 내용 행은 위아래 20px, 아랫선 1px `--color-line`, 패널 안 마지막 행은 아랫선 없음. 제목은 21px, 보조 문구는 14px 흐린 글자. 선택 행은 최소 높이 44px, 좌우 8px, 올리면 `--color-subtle`, `aria-current`나 `aria-pressed`면 `--color-selected` 배경과 왼쪽 3px `--color-primary` | `.row`, `.rosterRow`, `.pendingRow`, 내 출석 `.list a`, 공지 `.row` |
| `Form` | 세로 폼. `layout="inline"`이면 가로 필터 줄 | 세로는 필드 사이 16px, 제출 버튼은 내용 폭만 차지하고 위 12px. 가로는 줄바꿈 허용, 사이 8px, 라벨 13px, 입력과 선택은 내용 폭에 최소 120px | `.form`, `.inlineForm`, `.filters` |
| `Field` | 라벨, 입력, 도움말, 오류 한 묶음 | 라벨 14px 굵기 650, 라벨과 입력 사이 8px, 도움말 13px 흐린 글자, 오류는 `Feedback tone="error"`. 라벨은 `htmlFor`로 입력과 연결하고 도움말과 오류는 `aria-describedby`로 연결한다. 오류가 있으면 입력에 `aria-invalid` | `.fieldGroup`, `.fieldLabel`, `.hint`, `.form label` |
| `Facts` | 이름과 값의 표(`dl`). 일시, 대상, 상태처럼 짧은 사실 | 두 열 격자 7rem과 나머지, 1px 테두리, `--radius-panel`, 행 사이 1px 선. 이름 칸은 `--color-subtle` 배경에 13px 흐린 글자 굵기 650, 값 칸은 14px. 760px 이하에서는 한 열로 이름 위 값 아래 | `.facts` |
| `BackLink` | "← 홈" 같은 되돌아가기 | 가로 배치, 최소 높이 44px, `--color-primary`, 굵기 650, 아래 16px, 올리면 밑줄 | `.back`, `.backLink` |
| `Callout` | 안내 상자 | 1px `--color-highlight` 테두리, `--radius-control`, 안쪽 16px 20px, `--color-subtle` 배경, 글자 14px 줄 간격 1.7 | `.callout`, `.pendingNote` |

여기에 글자 클래스 하나를 더한다. `muted`는 14px `--color-muted`이며 페이지 머리 설명, 행의 보조 문구, 빈 목록 안내처럼 둘째 가는 글에 쓴다. 지금 각 CSS의 `p:not([class])` 규칙을 이것으로 바꾼다.

### 페이지 규칙

- 내부 화면의 순서는 `BackLink`(있으면), `PageHeader`, 머리 설명(`muted`, 있으면), 그다음 `Section`과 `Panel`이다.
- 폭은 지금대로다. 운영진 다섯 화면은 `page`(1240px), 일정 상세, 공지, 내 출석 같은 읽는 화면은 `readingPage`(880px)다. 폭 틀은 부품으로 만들지 않는다. `ui.module.css`의 `page`와 `readingPage` 클래스를 화면과 스켈레톤이 바로 쓰고, 기능 CSS의 `.page { composes: ... }`는 지운다.
- 폼과 상세는 패널, 목록은 구분선이다. 이 규칙은 2026-10-02에 정한 것이고 그대로 둔다. 패널은 한 겹이다.
- 제목은 h1 하나, 섹션은 h2, 패널 안의 더 작은 제목만 h3다.
- 일정 종류 색(`--kind-*`)과 상태 배지 색은 지금 쓰임을 유지한다.

### 일정 상세 재구성

2026-11-05 스크린샷의 `/events/[id]`는 이렇게 바뀐다.

- `BackLink` "← 홈", `PageHeader`에 일정 이름.
- `Panel` 하나. 안에 `Facts`로 일시와 대상을 두고, 취소된 일정이면 상태 행을 더한다. 장소는 따로 받는 값이 아니라 운영진이 설명에 적는 글이므로 설명 문단 그대로 둔다. 설명은 `Linkify`를 유지한다.
- `Section` "참석 응답"은 제목 옆에 현재 응답 배지를 둔다. 참석과 불참 버튼 쌍은 `Button size="large"` 둘을 같은 폭으로 나란히 두는 지금 배치를 유지하되, 그 배치 CSS는 `EventRsvp` 쪽에 남긴다. 홈 달력의 이달의 일정 목록도 같은 부품을 쓰므로 거기서도 같은 모양이다.
- `Section` "내 출석"은 제목 옆에 출석 상태 배지, 오른쪽 동작에 "운영진 출석 관리"를 `ActionLink variant="secondary" size="small"`로 둔다. "현장 출석하기"는 지금처럼 주요 버튼이다.
- 패널 안 두 섹션 사이는 구분선이다.
- 홈 달력의 "다가오는 내 일정" 카드는 지금 모양을 유지한다. 달력 카드 안에 테두리 표를 넣으면 상자가 한 겹 늘기 때문이다. `Facts`는 상세 화면에서만 쓴다. `EventDetail`에 변형 prop을 두든 `EventPage`가 따로 조립하든 만드는 사람이 정한다. `EventCalendar.module.css`의 `.card`는 `Panel`로 바꾸고, `.detail`은 달력 격자의 자리 이름이므로 남긴다.

### 옮길 화면

내부 화면 가운데 자기 CSS에 페이지, 섹션, 패널, 목록, 행, 폼, 도움말, 사실 표, 뒤로 가기를 정의한 파일은 전부 옮긴다. 지금 확인한 것은 다음과 같다.

| 묶음 | 화면과 파일 |
| --- | --- |
| 운영진 | 가입 신청 `ApplicationQueue`, 일정 관리 `EventEditor`와 `EventBatchCreator`, `AdminEventRsvps`, 단원 계정 `MemberAccountManager`, 공지 관리 `NoticeEditor`, 출석 관리 `AdminAttendancePanel` |
| 단원 | 일정 상세 `EventPage`, `EventDetail`, `EventRsvp`, 공지 `NoticeList`, 내 출석 `MyAttendancePage` |
| CSS | `AdminPages.module.css`, `EventEditor.module.css`, `EventCalendar.module.css`의 `.card`와 `.detail`, `NoticeList.module.css`, `MyAttendancePage.module.css` |

`CheckInPanel`, `WaitingScore`, `PageGate`, `MemberLinksPage`, `NoticePoll`, 홈 달력 `EventCalendar`의 격자는 만드는 사람이 보고 같은 정의가 있으면 옮기고 없으면 둔다.

단원 계정과 출석 관리의 목록과 상세 두 칸 배치(`.workspace`, 760px 이하의 `data-view` 전환, `useListDetailFocus`)는 운영진 두 화면만의 배치로 `AdminPages.module.css`에 남긴다. 새 부품을 만들지 않는다. 목록 칸은 `List`와 선택 행 `Row`, 상세 칸은 `Panel`을 쓴다.

각 화면의 스켈레톤 컴포넌트도 같은 부품으로 그려서 기다리는 화면과 준비된 화면의 높이가 맞게 한다. 2026-10-04에 세션 전후로 본문이 44px 밀리던 문제가 있었다.

### 순서

1. 부품과 CSS, `/design-system` 전시. 한 커밋.
2. 일정 상세. 스크린샷으로 제각각이라고 짚은 화면이고 단원이 가장 자주 여는 상세다.
3. 운영진 다섯 화면. 화면마다 한 커밋.
4. 공지, 내 출석 등 단원 목록 화면.
5. `docs/design-system.md` 갱신.

만드는 사람이 순서를 바꿔도 된다.

### 검증

- 화면을 하나 옮길 때마다 `npm run lint`, `npx next typegen`을 거친 `npx tsc --noEmit`, 관련 `vitest`를 돌린다.
- 모의 API 응답으로 개발 서버를 띄워 390px와 1440px에서 옮긴 화면을 캡처하고 옮기기 전과 비교한다. 가로 넘침, 초점 표시, 라벨 연결, 스켈레톤과 준비된 화면의 높이를 본다. 이 방식은 2026-10 검증 기록과 같다.
- `/design-system`에서 부품 아홉 개를 한 화면에서 확인한다.
- 실제 구글 로그인과 운영 DB는 검증 범위가 아니다.

## 제약

- Next 16.3.6, React 19, CSS Modules와 `tokens.css`만 쓴다. `composes`는 지금처럼 써도 된다.
- 린트의 `react-hooks` 규칙(`refs`, `set-state-in-effect`)을 지킨다.
- 작업 폴더의 줄바꿈은 CRLF와 LF가 섞여 있다. 여러 줄 치환 전에 정규화한다.
- 화면 문구에 대시(—)와 가운뎃점(·)을 쓰지 않는다. 범위는 물결표(~)다.
- 커밋 메시지는 짧고 같은 꼴이며 Claude 표기를 넣지 않는다. 커밋과 푸시는 사용자 요청이나 승인 뒤에 한다.

## 만드는 사람에게 맡기는 것

- 각 부품의 정확한 props 이름과 `Row`의 두 변형을 하나의 컴포넌트로 할지 둘로 나눌지.
- `Field`가 `id`와 `aria-describedby`를 잇는 방식.
- `index.tsx`와 `ui.module.css`를 나눌지.
- `Section` 제목을 h3로 써야 하는 자리의 처리.
- 화면을 옮기는 세부 순서와 테스트 수정 범위. 동작 검증은 유지한다.
