# 일정 종류와 파트연습 ②단계 구현 계획

**Goal:** 일정마다 종류(전체연습·파트연습·행사)와 파트를 두고, 파트연습은 그 파트 단원만 참석 응답·출석 대상이 되게 한다. 수석은 자기 파트의 파트연습을 열고 고치고 응답 집계를 본다.

**Architecture:** `event`에 `kind`와 `part` 열을 더한다. 순수 자바 레코드 `EventAccess`가 회원의 사이트 관리자 여부·단원 구분·파트·직책에서 "이 일정을 고칠 수 있는가, 볼 수 있는가, 대상인가, 명단을 볼 수 있는가"를 계산한다. 일정·참석 응답·출석 API가 모두 이 판단을 쓰고, 웹은 같은 규칙을 `session.ts`의 함수로 옮겨 메뉴와 입력을 가린다. 서버가 항상 다시 검사한다.

**Tech Stack:** Spring Boot 4.1 (Java 21, JPA, Flyway, Testcontainers PostgreSQL 17), Next.js 16 (React 19, CSS Modules, Vitest, Testing Library)

**Spec:** `docs/superpowers/specs/2026-10-03-member-roles-design.md`의 "행사 종류와 파트연습", "화면"의 행사 관리·파트연습 집계, "구현 순서" 2.

## Global Constraints

- 용어는 `CONTEXT.md`를 따른다. 화면 문구는 "일정", "참석 응답", "출석", "단원"을 쓴다.
- 실제 사람 이름, 학과, 학번은 코드·테스트·문서에 넣지 않는다.
- 이미 적용된 마이그레이션 파일은 고치지 않는다. 새 파일은 `api/src/main/resources/db/postgresql/V6__event_kind.sql`이다.
- 모든 권한은 서버에서 다시 검사한다. 화면은 숨기기만 한다.
- 새 CSS는 `web/src/styles/tokens.css`의 토큰만 쓴다. 새 라이브러리를 추가하지 않는다.
- 주석은 한국어로 쓰고, 동작이 바뀐 곳의 기존 주석도 함께 고친다.
- API 테스트는 Docker가 필요하다(Testcontainers). `api` 폴더에서 `./gradlew test --tests <클래스>`, 웹은 `web` 폴더에서 `npx vitest run <경로>`, `npx eslint`, `npx tsc --noEmit`, `npm run build`.

## 규칙

### 종류와 파트

| 종류 | 코드 | 파트 |
| --- | --- | --- |
| 전체연습 | `FULL_REHEARSAL` | 없음 |
| 파트연습 | `PART_REHEARSAL` | 반드시 하나(소프라노·알토·테너·베이스·피아노) |
| 행사 | `EVENT` | 없음 |

- 기존 일정은 설계대로 모두 "행사"가 된다. 지금 "전체연습"·"○○ 파트연습" 제목으로 등록된 일정도 행사로 남으며, 필요하면 권한이 있는 운영진이 종류를 바꾼다.
- 파트 규칙을 어기면 400 `INVALID_EVENT_PART`로 거부한다. DB에도 같은 검사 제약을 둔다.

### 누가 무엇을 하는가

| 할 수 있는 일 | 사이트 관리자 | 단장·부단장 | 총무 | 그 파트 수석 | 다른 운영진(부장·부원·다른 파트 수석) | 그 파트 단원 | 다른 파트 단원 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 전체연습 등록·수정 | ○ | ○ | | | | | |
| 파트연습 등록·수정 | ○ | ○ | | ○ | | | |
| 행사 등록·수정 | ○ | ○ | ○ | ○ | ○ | | |
| 파트연습 보기(일정 목록·상세) | ○ | ○ | ○ | ○ | ○ | ○ | |
| 파트연습 참석 응답·현장 출석 | 그 파트 단원일 때만 | 〃 | 〃 | 〃 | 〃 | ○ | |
| 파트연습 응답 집계 보기 | ○ | ○ | ○ | ○ | | | |
| 파트연습 출석 창 열기·닫기·출석 명단·정정 | ○ | ○ | ○ | ○ | | | |

- 전체연습·행사의 응답 집계와 출석 창은 지금처럼 `MANAGE_EVENTS`(운영진 전원)다.
- "출석 창 열기"는 출석 관리 화면에서 10분 동안 유효한 QR과 입력 코드를 발급하는 일이다. 창이 닫히거나 시간이 지나면 출석하지 않은 대상 단원은 미출석으로 남는다.
- 일정을 수정할 때는 바꾸기 전과 바꾼 뒤의 종류·파트 모두에 권한이 있어야 한다. 수석이 자기 파트연습을 전체연습이나 다른 파트로 바꾸지 못하게 하기 위해서다.
- 일괄 등록은 항목마다 같은 규칙을 적용하고, 하나라도 권한이 없으면 아무것도 저장하지 않는다(403).
- OB 규칙은 그대로다. OB는 OB 참여 대상 일정만 목록에서 보고 응답한다. 파트연습이면 그 파트 OB만 대상이다.
- 파트 대상 판정은 단원 정보의 파트(`member.part`)로 한다. 파트가 비어 있는 단원은 어떤 파트연습의 대상도 아니다.
- 다른 파트 단원이 파트연습 상세를 열면 404 `EVENT_NOT_FOUND`로 응답한다. 존재 여부를 드러내지 않는다.

### 사용자가 정한 것 (2026-10-27)

1. **파트연습이 보이는 사람**: 설계대로 그 파트 단원과 운영진 전원이다.
2. **파트연습 응답 집계와 출석 관리**(출석 창 열기·닫기, 출석 명단, 정정): 그 파트 수석, 단장단(단장·부단장·총무), 사이트 관리자다. 설계 본문의 "단장단"을 따르며, 출석 명단도 응답 집계와 같은 사람이 본다.

이를 위해 설계 권한 표의 "모든 파트의 파트연습 개최·수정과 참여 집계 열람" 줄을 둘로 나눈다.

| 권한 | 뜻 | 가진 직책 |
| --- | --- | --- |
| `MANAGE_PART_REHEARSALS` (기존) | 모든 파트의 파트연습 등록·수정 | 단장, 부단장 |
| `MANAGE_PART_ATTENDANCE` (새로 만듦) | 모든 파트의 파트연습 응답 집계와 출석 관리 | 단장, 부단장, 총무 |

수석은 권한 목록이 아니라 수석 직책의 파트(`MemberRole.part`)로 자기 파트에 같은 일을 한다.

### 이 계획이 정한 것

- 일정 관리 목록에는 고칠 수 있거나 응답 집계·출석 관리를 할 수 있는 일정이 나온다. 전체연습·행사는 운영진 전원에게 나오고, 파트연습은 그 파트 수석과 단장단·사이트 관리자에게만 나온다. 고칠 수 없는 일정(예: 총무가 보는 전체연습·파트연습)은 수정 폼을 읽기 전용으로 두고 출석 관리 링크와 응답 집계만 보인다. 총무 등이 전체연습 출석 창을 여는 지금 흐름을 끊지 않기 위해서다.
- 다른 파트의 집행부·수석진은 파트연습을 일정에서 볼 수 있지만 참석 응답 버튼과 출석 안내는 보이지 않는다.
- 출석 창을 연 뒤 종류·파트를 바꾸는 것은 막지 않는다. 이미 연 창의 대상 스냅샷은 그대로 남고, 이후 판정은 새 종류·파트를 따른다. 지금 OB 참여 대상 표시를 바꿀 때와 같다.
- 일정 아이콘(`EventKind.tsx`)은 파트연습이면 DB 종류로 "파트연습" 아이콘을 쓰고, 나머지는 지금처럼 제목으로 정기연습·리허설·공연 등을 알아맞힌다.

## 파일 구조

API (`api/src/main/java/kr/ac/jnu/choir/`):
- `event/EventKind.java` — 종류 enum (새로 만듦)
- `event/EventAccess.java` — 회원 기준 일정 권한·노출·대상 판단, 순수 자바 (새로 만듦)
- `event/EventAccessService.java` — 회원의 직책을 읽어 `EventAccess`를 만드는 Spring 서비스 (새로 만듦)
- `event/Event.java` — `kind`, `part` 열과 생성·수정 인자 추가
- `event/EventService.java` — 생성·일괄 생성·수정에 종류·파트와 파트 규칙 검사 추가
- `event/EventController.java` — 입력·응답에 `kind`, `part` 추가, 권한 검사를 `EventAccess`로 교체, 목록·상세 노출 필터
- `event/EventRsvpService.java` — 응답 대상·집계 명단에 파트 조건 추가
- `attendance/CheckInService.java` — 출석 대상 스냅샷·판정·명단에 파트 조건 추가
- `attendance/AttendanceController.java` — 파트연습의 운영진 출석 기능 권한
- `auth/Permission.java` — `MANAGE_PART_ATTENDANCE` 추가
- `auth/Permissions.java` — 단장·부단장·총무에게 `MANAGE_PART_ATTENDANCE`, `leadParts(...)` 추가(수석 직책의 파트 집합)
- `resources/db/postgresql/V6__event_kind.sql` — 마이그레이션 (새로 만듦)

API 테스트 (`api/src/test/java/kr/ac/jnu/choir/`):
- `event/EventAccessTest.java` — 순수 단위 테스트 (새로 만듦)
- `event/PartRehearsalTest.java` — 파트연습 통합 테스트 (새로 만듦)
- `auth/PermissionsTest.java` — 직책별 권한 집합 갱신, `leadParts` 테스트 추가
- `event/EventVisibilityTest.java`, `event/EventBatchDuplicateTest.java`, `security/AuthorizationMatrixTest.java`, `attendance/CheckInFlowTest.java`, `attendance/ConcurrentCheckInTest.java` — 입력에 `kind` 추가, `EventService.create` 인자 변경 반영

웹 (`web/src/`):
- `features/event/events.ts` — `ScheduleKind` 타입, `ChoirEvent.kind/part`, 입력 타입, 종류 이름, `isEventTarget`, `eventAudience`
- `features/auth/session.ts` — 권한 타입에 `MANAGE_PART_ATTENDANCE`, `leadParts`, `canManageEvent`, `canManageRoster`, `manageableKinds`, `manageableParts`
- `features/event/EventBatchCreator.tsx` — 종류·파트 선택과 기본 제목
- `features/event/EventEditor.tsx` — 목록 거르기, 수정 폼의 종류·파트, 읽기 전용
- `features/event/EventKind.tsx` — 파트연습은 DB 종류로 판별
- `features/event/EventCalendar.tsx`, `EventRsvp.tsx`, `EventDetail.tsx`, `EventPage.tsx` — 대상 판단을 `isEventTarget`으로 교체, 대상 문구
- `features/attendance/AdminAttendancePanel.tsx` — "파트연습에는 출석 창을 열지 마세요" 경고를 출석 대상 안내로 교체
- 각 파일의 `*.test.tsx`/`*.test.ts`

웹 E2E: `web/e2e/setup.ts`, `web/e2e/member-journey.spec.ts`의 일정 생성 요청에 `kind` 추가.

문서: `docs/operations.md`의 "행사와 출석 현장 대응" 파트연습 단락, `docs/design-system.md`의 적용 검증 기록.

---

### Task 1: 종류·파트 열과 입력 (API)

**Files:** `V6__event_kind.sql`, `EventKind.java`, `Event.java`, `EventService.java`, `EventController.java`, 기존 테스트 5개

**Interfaces:**
- Produces: `enum EventKind { FULL_REHEARSAL, PART_REHEARSAL, EVENT }`, `EventInput(title, description, startAt, endAt, @NotNull kind, part, obEligible, publicVisible)`, `EventItem`에 `kind`, `part` 추가, `EventService.create/update(..., EventKind kind, Part part, ...)`

- [ ] 마이그레이션을 쓴다. `kind VARCHAR(32) NOT NULL DEFAULT 'EVENT'`로 더해 기존 행을 행사로 채운 뒤 기본값을 지우고, `ck_event_kind`(세 값)와 `ck_event_part`(파트연습은 다섯 파트 중 하나, 나머지는 NULL) 제약을 둔다.
- [ ] 기존 테스트의 일정 JSON에 `"kind":"EVENT"`를 넣고 `EventService.create` 호출을 새 인자로 바꾼다. 아직 컴파일되지 않는 것을 확인한다.
- [ ] 엔티티·서비스·컨트롤러에 종류·파트를 더하고 파트 규칙 위반을 400 `INVALID_EVENT_PART`로 거부한다. 일괄 등록 중복 검사(제목+시작 시각)는 그대로 둔다.
- [ ] `PartRehearsalTest`의 첫 테스트로 파트 규칙 400과 DB 제약을 확인한다.
- [ ] 기존 API 테스트 전체가 통과하는지 확인하고 커밋한다.

### Task 2: 일정 권한 계산 (API, 순수 자바)

**Files:** `Permission.java`, `Permissions.java`, `EventAccess.java`, `EventAccessService.java`, `PermissionsTest.java`, `EventAccessTest.java`

**Interfaces:**
- Produces: `Permission.MANAGE_PART_ATTENDANCE`, `Permissions.leadParts(MemberType, Collection<MemberRole>): Set<Part>`(활동 단원의 수석 직책 파트만), `EventAccess(boolean siteAdmin, MemberType memberType, Part part, Set<Permission> permissions, Set<Part> leadParts)`와 `canManage(EventKind, Part)`, `canSee(Event)`, `isTarget(Event)`, `canManageRoster(Event)`, `EventAccessService.of(Member): EventAccess`

- [ ] `PermissionsTest`의 직책별 기대 집합을 바꾼다: 부단장·단장에 `MANAGE_PART_ATTENDANCE`가 더해지고, 총무는 다른 운영진 집합에 `MANAGE_PART_ATTENDANCE`가 더해진다. 부장·부원·수석은 그대로다.
- [ ] 실패하는 단위 테스트를 쓴다: 위 "누가 무엇을 하는가" 표의 행마다 사이트 관리자·단장·부단장·총무·부장·테너수석·소프라노수석·겸임(부단장+테너수석)·테너 단원·소프라노 단원·파트 미지정 단원·테너 OB를 확인한다.
- [ ] 구현하고 통과를 확인한 뒤 커밋한다.

### Task 3: 일정 등록·수정·조회 (API)

**Files:** `EventController.java`, `PartRehearsalTest.java`

- [ ] 실패하는 통합 테스트를 쓴다.
  - 테너수석: 테너 파트연습 201, 소프라노 파트연습 403, 전체연습 403, 행사 201. 자기 테너 파트연습을 전체연습·소프라노로 바꾸기 403, 소프라노 파트연습 수정 403.
  - 부단장: 모든 파트의 파트연습과 전체연습 201. 총무: 전체연습 403, 행사 201.
  - 일괄 등록에 권한 없는 항목이 하나 섞이면 403이고 아무것도 저장되지 않는다.
  - 목록·상세: 테너 단원과 다른 파트 총무에게 보이고, 소프라노 단원 목록에서 빠지며 상세는 404다. 테너 OB는 OB 참여 대상일 때만 목록에 보인다.
- [ ] `create`·`createBatch`·`update`의 `MANAGE_EVENTS` 검사를 `EventAccess.canManage`로 바꾸고(수정은 기존 값도 검사), 목록·상세에 `canSee`를 적용한다. 권한 없음은 기존과 같은 403 `PERMISSION_REQUIRED`다.
- [ ] 통과를 확인하고 커밋한다.

### Task 4: 참석 응답 (API)

**Files:** `EventRsvpService.java`, `EventController.java`, `PartRehearsalTest.java`

- [ ] 실패하는 테스트를 쓴다: 테너 단원 응답 200, 소프라노 단원과 다른 파트 총무 응답 403 `EVENT_NOT_ELIGIBLE`, 집계 명단은 테너 단원만이고 미응답 수도 테너 기준, 집계 열람은 테너수석·부단장·총무·사이트 관리자 200, 소프라노수석·부장 403.
- [ ] `respond`·`mine`의 대상 판정과 `adminView`의 명단 SQL에 파트 조건을 더하고, 집계 권한을 `canManageRoster`(파트연습)·`MANAGE_EVENTS`(그 밖)로 나눈다.
- [ ] 통과를 확인하고 커밋한다.

### Task 5: 출석 (API)

**Files:** `CheckInService.java`, `AttendanceController.java`, `PartRehearsalTest.java`

- [ ] 실패하는 테스트를 쓴다: 테너수석이 연 출석 창의 대상 스냅샷은 승인된 테너 활동 단원만이다. 소프라노 단원 코드 입력 403 `NOT_ELIGIBLE`. 창을 닫은 뒤 소프라노 단원의 내 출석 목록에 그 일정이 없고, 출석 관리 명단은 테너 단원만이다. 총무는 출석 창을 열고 명단을 볼 수 있고, 소프라노수석·부장의 출석 창 열기·명단·정정은 403이다. 기존 `CheckInFlowTest`는 그대로 통과한다.
- [ ] 일정 행에 종류·파트, 회원 행에 파트를 읽어 `eligible`, 스냅샷 SQL, 명단 SQL에 파트 조건을 더한다. 운영진 출석 기능의 권한을 `canManageRoster`(파트연습)·`MANAGE_EVENTS`(그 밖)로 나눈다.
- [ ] 통과를 확인하고 커밋한다.

### Task 6: 일정 관리 화면 (웹)

**Files:** `events.ts`, `session.ts`, `EventBatchCreator.tsx`, `EventEditor.tsx`와 테스트

- [ ] 실패하는 테스트를 쓴다.
  - 테너수석 세션: 일괄 등록의 종류는 "파트연습·행사", 파트는 "테너"만 고를 수 있다. 파트연습·테너를 고르면 제목이 "테너 파트연습"으로 바뀌고, 요청에 `kind: "PART_REHEARSAL", part: "TENOR"`가 실린다. 제목을 직접 고친 뒤에는 종류를 바꿔도 제목을 덮지 않는다.
  - 부단장 세션: 세 종류와 다섯 파트가 모두 보이고 기본 종류는 전체연습, 기본 제목은 지금처럼 "전체연습"이다.
  - 일정 관리 목록: 테너수석에게 소프라노 파트연습은 보이지 않고, 전체연습은 보이지만 수정 폼이 읽기 전용이며 저장 버튼이 없다. 총무에게는 모든 파트연습이 읽기 전용으로 보인다. 목록 행에 종류(파트연습이면 "테너 파트연습")를 함께 보인다.
- [ ] 구현한다. 종류·파트 선택은 공통 `Select`와 라벨을 쓴다.
- [ ] 테스트·린트·타입 검사를 통과시키고 커밋한다.

### Task 7: 단원 화면과 출석 관리 화면 (웹)

**Files:** `EventKind.tsx`, `EventCalendar.tsx`, `EventRsvp.tsx`, `EventDetail.tsx`, `EventPage.tsx`, `AdminAttendancePanel.tsx`와 테스트, E2E 일정 생성 요청

- [ ] 실패하는 테스트를 쓴다: 다른 파트 운영진이 보는 테너 파트연습에는 참석 응답 버튼·응답 칩·출석 안내가 없고 대상 배지가 "테너 단원 대상"이다. 테너 단원에게는 지금처럼 보인다. 파트연습은 제목과 상관없이 파트연습 아이콘이다. 출석 관리 화면은 경고 대신 "출석 대상: 테너 단원"(OB 포함이면 "테너 단원 · OB")을 보인다.
- [ ] `memberType`으로 하던 대상 판단 세 곳을 `isEventTarget(event, session)`으로 바꾼다.
- [ ] 웹 전체 테스트·린트·타입 검사·운영 빌드를 통과시키고 커밋한다.

### Task 8: 문서와 화면 확인

- [ ] `docs/operations.md`의 "파트연습에는 출석 창을 열지 않습니다" 단락과 수석의 파트연습 진행 단락을 새 절차로 바꾼다: 종류 "파트연습"과 파트를 골라 등록, 응답 집계는 그 파트 단원만, 출석 창 사용 가능, 단원 정보의 파트가 비어 있으면 대상에서 빠지므로 `/admin/members`에서 먼저 확인.
- [ ] `docs/superpowers/specs/2026-10-03-member-roles-design.md`의 권한 표에서 "모든 파트의 파트연습 개최·수정과 참여 집계 열람" 줄을 "등록·수정"(단장·부단장)과 "응답 집계·출석 관리"(단장·부단장·총무)로 나누고, 수석 줄에 출석 관리를 더한다.
- [ ] API 전체 테스트, 웹 전체 테스트·린트·타입 검사·운영 빌드를 실행한다.
- [ ] 모의 API로 부단장·테너수석·테너 단원·소프라노 단원 세션의 일정 관리, 일정, 출석 관리 화면을 1440px와 390px에서 캡처해 가로 넘침과 표시를 확인하고 `docs/design-system.md`에 기록한다.
- [ ] 커밋하고 `feat/intelligent-hopper-h24sws`에 푸시한다.

## 실행 결과 (2026-10-27)

사용자 요청으로 웹과 검증 범위를 줄였다.

- API: Task 1~5를 계획대로 구현했다. API 전체 테스트 112개가 통과했다. 테스트 중 파트 없는 파트연습이 DB 검사 제약을 통과하는 문제(검사 결과가 NULL이면 통과)를 발견해 NULL이 나오지 않는 식으로 고쳤다.
- 웹: 종류·파트 선택(일괄 등록·수정), 일정 관리 목록 거르기와 고칠 수 없는 일정의 저장 버튼 숨김, 다른 파트 파트연습의 응답·출석 버튼 숨김, 출석 관리 화면의 출석 대상 안내만 했다. 웹 테스트 263개, 타입 검사, 린트, 운영 빌드가 통과했다.
- 하지 않은 것: 일정 아이콘을 DB 종류로 판별하기(제목에 "파트"가 있으면 지금도 파트연습 아이콘), 수정 폼의 읽기 전용 처리, 모의 API 화면 캡처와 `design-system.md` 기록, 웹 E2E 실행.
- 다른 파트 단원이 파트연습의 현장 출석 주소나 내 출석 상태 주소를 직접 열면 "출석 대상이 아닙니다"가 보인다. 일정 목록·상세에서는 보이지 않는다.

## 배포 뒤 할 일

- 운영 DB 백업을 남긴 뒤 배포하고, Render 로그에서 Flyway `V6` 적용을 확인한다.
- API와 웹이 둘 다 새 버전으로 바뀌기 전에는 일정을 등록하지 않는다. 새 웹이 옛 API에 종류를 보내면 옛 API는 그 값을 모른 채 행사로 저장할 수 있다.
- 테너수석 직책에 파트 "테너"가 지정돼 있는지, 테너 단원들의 단원 정보 파트가 "테너"인지 `/admin/members`에서 확인한다.
- 테너 단원 몇 명으로 파트연습 등록 → 참석 응답 → 출석 창 → 코드·QR 출석 → 창 닫기 → 다른 파트 단원의 내 출석에 기록이 없는지까지 시범한다.
