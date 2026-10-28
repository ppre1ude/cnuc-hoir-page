# 일정 목록 화면과 정기, 비정기 구분 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일정 종류를 정기연습, 비정기연습, 파트연습, 중요 행사 넷으로 나누고, 단원이 달별 연습 횟수와 함께 다가오는 일정을 훑는 `/events` 화면을 만든다.

**Architecture:** `FULL_REHEARSAL`을 `REGULAR_REHEARSAL`과 `EXTRA_REHEARSAL`로 나누고 V8 마이그레이션이 기존 일정을 제목으로 옮긴다. 권한은 두 값을 지금 전체연습과 똑같이 다룬다. 웹은 기존 `GET /events`와 `GET /events/rsvps/me`만으로 목록을 그리고, 메뉴에 홈을 더해 대시보드를 홈으로 부른다.

**Tech Stack:** Spring Boot 4.1 (Java 21, Flyway, Testcontainers PostgreSQL 17), Next.js 16 (React 19, CSS Modules, Vitest, Testing Library)

**Spec:** `docs/superpowers/specs/2026-10-28-event-list-design.md`

## Global Constraints

- 화면 문구에 대시(—)와 가운뎃점(·)을 쓰지 않는다. 범위는 `~`, 나열은 칸이나 배지로 나눈다. 기존 화면의 가운뎃점은 고치지 않는다.
- 이미 적용된 마이그레이션(V1~V7)은 고치지 않는다. 새 파일은 `api/src/main/resources/db/postgresql/V8__event_kind_regular.sql`.
- 권한 이름 `MANAGE_FULL_REHEARSALS`는 그대로 둔다.
- 새 CSS는 `web/src/styles/tokens.css` 토큰과 `docs/design-system.md`만 따른다. 종류 색은 `EventCalendar.module.css`의 `--kind-*` 값을 쓴다. 새 라이브러리 없음.
- 주석은 한국어, 동작이 바뀐 곳의 기존 주석도 고친다. 커밋 메시지에 Co-Authored-By나 "Generated with Claude Code"를 넣지 않는다.
- API 테스트는 Docker 필요. `api`에서 `./gradlew test --tests <클래스>`. 웹은 `web`에서 `npx vitest run <경로>`, `npx tsc --noEmit`, `npm run lint`.

## Review Focus

- 연말을 넘는 범위: 10월 이후에는 목록이 다음 해 1월까지 닿는다. 올해가 아닌 달은 "2027년 1월"처럼 연도를 붙인다(Task 3 테스트).
- 오늘 이미 끝난 일정: 범위가 오늘 0시(서울)부터라 목록에 남는다. 오늘 일정은 찾기 쉬워야 하므로 의도한 동작이다(Task 3 테스트).
- 참석 응답만 실패: 일정은 보이고 응답 칩만 빠져야 한다(Task 3 테스트).
- 배포 중 옛 화면이 `FULL_REHEARSAL`을 보내면 400으로 거절된다(Task 1 테스트). 새로고침하면 풀린다.
- 제목에 '연습'과 '파트'가 함께 든 행사는 파트를 알 수 없어 중요 행사로 남는다(Task 1 테스트).

---

### Task 1: API 종류 넷과 V8 마이그레이션

**Files:**
- Modify: `api/src/main/java/kr/ac/jnu/choir/event/EventKind.java`
- Modify: `api/src/main/java/kr/ac/jnu/choir/event/EventAccess.java:13-20` (`canManage` 스위치와 주석)
- Create: `api/src/main/resources/db/postgresql/V8__event_kind_regular.sql`
- Test: `api/src/test/java/kr/ac/jnu/choir/event/EventAccessTest.java`, `api/src/test/java/kr/ac/jnu/choir/event/PartRehearsalTest.java`
- Create test: `api/src/test/java/kr/ac/jnu/choir/event/EventKindMigrationTest.java`

**Interfaces:**
- Produces: `EventKind { REGULAR_REHEARSAL, EXTRA_REHEARSAL, PART_REHEARSAL, EVENT }`. JSON 값도 이 이름 그대로.

- [ ] **Step 1: 기존 테스트의 `FULL_REHEARSAL`을 새 값으로 바꾸고 새 단언을 더한다**

`EventAccessTest`: `canManage(EventKind.FULL_REHEARSAL, null)` 검사를 `REGULAR_REHEARSAL`과 `EXTRA_REHEARSAL` 각각에 같은 기대값으로 돌린다. `canManageRoster`, `target`의 `FULL_REHEARSAL`도 `REGULAR_REHEARSAL`로 바꾼다.

`PartRehearsalTest`: `"FULL_REHEARSAL"` 입력을 `"REGULAR_REHEARSAL"`로 바꾸고, `operatorsCreateAndChangeOnlyKindsAndPartsTheyManage`에 비정기도 같은 결과인지 더한다.

```java
assertThat(write(tenorLead, post, input(unique("비정기연습"), "EXTRA_REHEARSAL", null, false)).getStatus()).isEqualTo(403);
create(vice, input(unique("비정기연습"), "EXTRA_REHEARSAL", null, false));
```

옛 값 거절 테스트를 더한다.

```java
@Test void oldFullRehearsalKindIsRejected() throws Exception {
    assertThat(write(admin, post("/api/v1/admin/events"), input(unique("전체연습"), "FULL_REHEARSAL", null, false))
            .getStatus()).isEqualTo(400);
}
```

- [ ] **Step 2: 마이그레이션 테스트를 쓴다**

`AdminBootstrapInvitationCommandTest`처럼 자체 `PostgreSQLContainer`와 `Flyway.configure()...locations("classpath:db/postgresql")`를 쓴다. `.target("7")`로 V7까지 올리고, 아래 행을 `event`에 넣은 뒤(나머지 NOT NULL 열은 아무 값) 끝까지 올린다.

```java
@Test void splitsFullRehearsalsAndRehearsalTitledEventsByTitle() {
    // V7 상태로 넣는 행: (kind, title) → V8 뒤 기대 kind
    // FULL_REHEARSAL "전체 정기연습"   → REGULAR_REHEARSAL
    // FULL_REHEARSAL "전체 비정기연습" → EXTRA_REHEARSAL
    // EVENT "전체 정기연습"            → REGULAR_REHEARSAL
    // EVENT "전체 비정기연습"          → EXTRA_REHEARSAL
    // EVENT "최종 리허설"              → EVENT
    // EVENT "소프라노 파트연습"        → EVENT
    // EVENT "제2회 정기연주회"         → EVENT
    assertThat(kindsByTitle()).containsExactlyInAnyOrderEntriesOf(expected);
}

@Test void oldKindIsRefusedByDatabaseAfterV8() {
    // 끝까지 올린 뒤 kind = 'FULL_REHEARSAL' 행 삽입이 SQLException(검사 제약)으로 실패한다.
}
```

- [ ] **Step 3: 실패를 확인한다**

Run: `./gradlew test --tests "kr.ac.jnu.choir.event.*"`
Expected: 컴파일 실패(`REGULAR_REHEARSAL` 없음).

- [ ] **Step 4: `EventKind`, `EventAccess`, V8을 구현한다**

`EventAccess.canManage`: `case REGULAR_REHEARSAL, EXTRA_REHEARSAL -> permissions.contains(Permission.MANAGE_FULL_REHEARSALS);`. 주석의 "전체연습"을 "정기연습과 비정기연습"으로 고친다.

V8은 이 내용 그대로 쓴다.

```sql
-- 전체연습을 정기연습과 비정기연습으로 나눕니다. 제목에 '비정기'가 있으면 비정기연습입니다.
-- V7이 기존 일정을 모두 행사로 옮겼으므로, 제목에 '연습'이 있는 행사도 옮깁니다. 파트를 알 수 없는 파트연습 제목은 행사로 둡니다.
ALTER TABLE event DROP CONSTRAINT ck_event_kind;
UPDATE event
SET kind = CASE WHEN title LIKE '%비정기%' THEN 'EXTRA_REHEARSAL' ELSE 'REGULAR_REHEARSAL' END
WHERE kind = 'FULL_REHEARSAL'
   OR (kind = 'EVENT' AND title LIKE '%연습%' AND title NOT LIKE '%파트%');
ALTER TABLE event ADD CONSTRAINT ck_event_kind
    CHECK (kind IN ('REGULAR_REHEARSAL', 'EXTRA_REHEARSAL', 'PART_REHEARSAL', 'EVENT'));
```

- [ ] **Step 5: 통과를 확인한다**

Run: `./gradlew test`
Expected: 전체 PASS. `FULL_REHEARSAL`이 `api/src`에 남지 않는다(`git grep FULL_REHEARSAL api/src`가 V7, V8 SQL과 `MANAGE_FULL_REHEARSALS`만 보인다).

- [ ] **Step 6: 커밋**

```bash
git add api/src
git commit -m "feat(api): 전체연습을 정기연습과 비정기연습으로 나누고 기존 일정을 제목으로 옮김"
```

### Task 2: 웹 종류 넷, 등록 화면, 권한, 아이콘

**Files:**
- Modify: `web/src/features/event/events.ts:5-6`
- Modify: `web/src/features/auth/session.ts:38-50`
- Modify: `web/src/features/event/EventEditor.tsx:29`, `web/src/features/event/EventBatchCreator.tsx:25-31`
- Modify: `web/src/features/event/EventKind.tsx`, `web/src/features/event/EventCalendar.tsx:211,239`
- Test: `web/src/features/event/EventKind.test.ts`, `web/src/features/event/EventBatchCreator.test.tsx`, `web/src/features/auth/session.test.ts`(없으면 만든다)

**Interfaces:**
- Consumes: Task 1의 JSON 값.
- Produces (`events.ts`):
  - `type ScheduleKind = "REGULAR_REHEARSAL" | "EXTRA_REHEARSAL" | "PART_REHEARSAL" | "EVENT"`
  - `const scheduleKinds: ScheduleKind[]` = 위 순서
  - `scheduleKindLabel`: 정기연습, 비정기연습, 파트연습, 중요 행사
  - `kindShortLabel: Record<ScheduleKind, string>`: 정기, 비정기, 파트, 중요 행사
- Produces (`EventKind.tsx`): `eventKind(event: Pick<ChoirEvent, "kind" | "title">): EventKind`, `EventKindIcon({ event }: { event: Pick<ChoirEvent, "kind" | "title"> })`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`EventKind.test.ts`를 바꾼다.

```ts
it.each([
  ["REGULAR_REHEARSAL", "아무 제목", "regular"],
  ["EXTRA_REHEARSAL", "전체연습", "extra"],
  ["PART_REHEARSAL", "테너 파트연습", "part"],
  ["EVENT", "최종 리허설", "rehearsal"],
  ["EVENT", "가을 정기연주회", "concert"],
  ["EVENT", "신입 발표회", "concert"],
  ["EVENT", "여름 MT", "trip"],
  ["EVENT", "총회", "other"],
  ["EVENT", "전체 정기연습", "other"],
] as const)("%s %s → %s", (kind, title, expected) => {
  expect(eventKind({ kind, title })).toBe(expected);
});
```

`session` 테스트: `MANAGE_FULL_REHEARSALS`만 가진 세션에서 `canManageEvent(session, "REGULAR_REHEARSAL", null)`과 `"EXTRA_REHEARSAL"`이 true, `"EVENT"`는 false.

`EventBatchCreator.test.tsx`: 기대 요청의 `kind: "FULL_REHEARSAL"`을 `"REGULAR_REHEARSAL"`로, 기본 제목을 "정기연습"으로 바꾼다. 종류 선택지가 순서대로 정기연습, 비정기연습, 파트연습, 중요 행사인지, 비정기연습을 고르면 제목이 "비정기연습"이 되는지 더한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/event src/features/auth`
Expected: FAIL (타입과 라벨이 옛 값).

- [ ] **Step 3: 구현한다**

- `canManageEvent`: `REGULAR_REHEARSAL`, `EXTRA_REHEARSAL`이면 `MANAGE_FULL_REHEARSALS`. 매개변수 타입은 `ScheduleKind`. `canManageRoster`의 `event.kind` 타입도 `ScheduleKind`.
- `EventEditor`, `EventBatchCreator`의 지역 `kinds`를 지우고 `scheduleKinds`를 쓴다. `defaultTitle`: 정기는 "정기연습", 비정기는 "비정기연습".
- `eventKind`: 정기 "regular", 비정기 "extra", 파트 "part". `EVENT`만 제목 규칙 `[/리허설/, "rehearsal"]`, `[/공연|연주회|발표회/, "concert"]`, `[/MT|엠티|워크숍|수련회/i, "trip"]`을 앞에서부터 보고, 없으면 "other". 파일 위 `ponytail:` 주석은 "행사만 제목으로 아이콘을 고른다"로 고친다.
- `EventCalendar`의 두 호출부가 일정 객체를 넘긴다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: 전체 PASS, 타입과 린트 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add web/src
git commit -m "feat(web): 일정 종류를 정기연습, 비정기연습, 파트연습, 중요 행사로 고르게 함"
```

### Task 3: 일정 목록 화면과 메뉴

**Files:**
- Modify: `web/src/features/event/events.ts` (`rsvpChip`, `Chip`을 `EventCalendar.tsx:44-55`에서 옮김, `addMonths` 추가)
- Modify: `web/src/features/event/EventCalendar.tsx` (옮긴 함수 import)
- Create: `web/src/features/event/EventList.tsx`, `web/src/features/event/EventList.module.css`, `web/src/features/event/EventList.test.tsx`
- Create: `web/src/app/(member)/events/page.tsx`
- Modify: `web/src/features/member/MemberNavigation.tsx:12-16,45`, `web/src/features/member/MemberNavigation.test.tsx`
- Modify: `web/src/app/(member)/dashboard/page.tsx` (metadata title "홈")
- Modify: `web/src/features/auth/PageGate.tsx:47`, `web/src/features/auth/PageGate.test.tsx:49` ("홈으로 가기")
- Modify: `web/src/features/event/EventCalendar.module.css:3-10` → `web/src/styles/tokens.css` (`--kind-*` 변수를 `.dashboard`에서 `:root`로 옮겨 목록 화면도 쓰게 함)

**Interfaces:**
- Consumes: Task 2의 `ScheduleKind`, `kindShortLabel`. 배지 색은 `EventCalendar.module.css`의 `.kind` 클래스와 `data-kind` 값.
- Produces (`events.ts`): `addMonths(month: string, count: number): string` ("2026-11", 3 → "2027-02"), `type Chip`, `rsvpChip(event, member, choice): Chip | null` (본문 그대로 옮김).
- Produces: `EventList()` 컴포넌트(props 없음, `useSession()` 사용).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`EventList.test.tsx`. 시계는 `2026-10-28T03:00:00Z`(서울 정오)로 고정하고 `getEvents`, `getMyEventRsvps`를 목으로 둔다. 세션은 활동 단원 테너. 다가오는 일정 목 데이터(서울 시각):

- 10/28 비정기 "전체 비정기연습" 19:00~21:00, 응답 ATTENDING
- 11/1 정기 "전체 정기연습" 18:00~20:00
- 11/3 비정기 "전체 비정기연습" 19:00~21:00
- 11/8 정기 "전체 정기연습" 18:00~20:00
- 11/12 파트 테너 "테너 파트연습"
- 11/20 중요 행사 "제2회 정기연주회"
- 2027/1/9 정기 "전체 정기연습"

```ts
it("오늘부터 3달 뒤 달 말까지 불러온다", async () => {
  expect(getEvents).toHaveBeenCalledWith("2026-10-27T15:00:00.000Z", "2027-01-31T15:00:00.000Z");
});
it("달마다 연습 횟수와 종류별 개수를 붙이고 이번 달은 남은 것만 센다", async () => {
  // 10월 묶음: "남은 연습 1회", 배지 "비정기 1"
  // 11월 묶음: "연습 5회", 배지 "정기 2" "비정기 1" "파트 1" "중요 행사 1" 순서
  // 올해가 아닌 달 제목은 "2027년 1월"
});
it("줄마다 종류 배지, 제목 링크, 시간, 응답 칩을 보인다", async () => {
  // 제목 링크 href "/events/{id}", 시간 텍스트는 /7:00.*9:00/, 10/28 줄에 "참석"
});
it("오늘 이미 끝난 일정도 남긴다", async () => { /* 10/28 09:00~10:00 일정이 보인다 */ });
it("참석 응답을 못 불러와도 일정은 보이고 칩만 빠진다", async () => {});
it("다가오는 일정이 없으면 안내한다", async () => { /* "다가오는 일정이 없습니다." */ });
it("지난 일정 보기를 누르면 지난 3달을 최신순으로 한 번 불러온다", async () => {
  // getEvents("2026-06-30T15:00:00.000Z", "2026-10-27T15:00:00.000Z"), 최신 일정이 먼저, 버튼은 사라진다
});
it("화면 문구에 가운뎃점과 대시가 없다", async () => {
  expect(document.body.textContent).not.toMatch(/[·—–]/);
});
```

`MemberNavigation.test.tsx`: 링크가 홈 `/dashboard`, 일정 `/events`, 공지, 내 출석 순서. `/events`와 `/events/12`에서 일정이 `aria-current="page"`, `/dashboard`에서는 홈.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/event/EventList.test.tsx src/features/member src/features/auth/PageGate.test.tsx`
Expected: FAIL (`EventList` 없음, 메뉴 셋).

- [ ] **Step 3: `events.ts`와 `EventCalendar.tsx`를 고친다**

`rsvpChip`과 `Chip`을 그대로 옮기고 `addMonths`를 더한다. `--kind-*` 변수 일곱 줄과 그 주석을 `tokens.css`의 `:root`로 옮긴다. 대시보드 동작과 모양은 바뀌지 않는다.

- [ ] **Step 4: `EventList`와 `/events` 화면을 만든다**

- 범위: `from`은 오늘 서울 0시(`seoulDateKey(new Date())` 날짜에 `T00:00:00+09:00`를 붙여 ISO로), `to = monthBounds(addMonths(이번 달, 3)).to`. 일정과 응답을 같은 범위로 부른다. 응답 실패는 칩만 빼고 오류 문구를 띄우지 않는다. 일정 실패는 `Feedback tone="error"` "일정을 불러오지 못했습니다."
- 정렬: 다가오는 일정은 시작 시각 오름차순, 지난 일정은 내림차순. 서울 날짜 기준으로 달을 묶는다.
- 달 제목: "11월", 올해가 아니면 "2027년 1월". 다가오는 묶음에만 "연습 N회"(이번 달은 "남은 연습 N회", N은 정기, 비정기, 파트 합)와 개수 1 이상인 종류 배지를 정기, 비정기, 파트, 중요 행사 순서로 "정기 2"처럼 붙인다.
- 줄: 날짜 숫자와 요일("수"), `kindShortLabel` 배지(클래스 `calendarStyles.kind`에 `data-kind`를 정기 "regular", 비정기 "extra", 파트 "part", 중요 행사 "concert"로 주고, 배지 모양은 `background: var(--kind-soft); color: var(--kind)`. 달 제목 옆 개수 배지도 같은 색), 제목은 `/events/{id}` 링크, 시간은 `${seoulTime(startAt)}~${seoulTime(endAt)}`, `rsvpChip`이 있으면 `StatusBadge`.
- 머리: `PageHeader` 제목 "다가오는 일정", 오른쪽에 `/dashboard`로 가는 "달력 →" 링크.
- 맨 아래 "지난 일정 보기" 버튼: 지난 3달(`monthBounds(addMonths(이번 달, -3)).from` ~ 오늘 0시)을 한 번 불러와 아래에 붙이고 버튼을 숨긴다.
- 로딩은 `SkeletonRows`. `/events/page.tsx`는 `attendance/page.tsx`처럼 `PageGate`로 감싸고 metadata title "일정", skeleton은 `SkeletonRows` 하나.

- [ ] **Step 5: 메뉴, 대시보드 제목, PageGate 문구를 고친다**

`links`: 홈 `/dashboard`, 일정 `/events`, 공지 `/notices`, 내 출석 `/attendance`. 활성 규칙은 `pathname === link.href || link.href === "/events" && pathname.startsWith("/events/")`. 로고 링크와 로그인 뒤 이동은 `/dashboard` 그대로.

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: 전체 PASS, 빌드 성공. (`NoticeListPoll`은 main에서도 가끔 흔들리는 테스트라 그것만 실패하면 따로 다시 돌린다.)

- [ ] **Step 7: 화면을 눈으로 확인한다**

`cnuc-hoir-member-page-preview` 기억의 Playwright route 목 방식으로 `/events`를 390px와 1440px에서 캡처한다. 달 제목 줄의 배지가 줄바꿈될 때 겹치지 않는지, 배지 색이 이달의 일정 아이콘과 맞는지 본다.

- [ ] **Step 8: 커밋**

```bash
git add web/src
git commit -m "feat(web): 다가오는 일정을 달별 연습 횟수와 함께 보는 일정 목록 화면과 홈 메뉴 추가"
```

### Task 4: 문서

**Files:**
- Modify: `CONTEXT.md`(일정 종류 용어), `docs/operations.md`(일정 등록 절차의 종류 설명)

- [ ] **Step 1: 종류 설명을 넷으로 고친다**

"전체연습"을 "정기연습, 비정기연습"으로, "행사"를 "중요 행사(연주회, 발표회, MT 등)"로 바꾼다. 배포 뒤 '최종 리허설'처럼 연습이 아닌 제목의 일정은 중요 행사로 남으니 운영진이 수정 화면에서 고친다는 한 줄을 운영 문서에 더한다.

- [ ] **Step 2: 커밋**

```bash
git add CONTEXT.md docs/operations.md
git commit -m "docs: 일정 종류 넷과 배포 뒤 확인할 일정 안내"
```
