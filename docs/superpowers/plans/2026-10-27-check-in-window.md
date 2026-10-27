# 출석 창을 연습 시간에 묶고 지각을 기록하는 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출석 창을 행사 시작 30분 전부터 종료까지로 묶고, 시작 15분 뒤 출석은 `LATE`로 저장하며, 코드를 4자리 숫자 평문으로 바꿔 운영진이 언제든 다시 볼 수 있게 한다.

**Architecture:** 판정은 전부 `CheckInService` 한 곳에서 행사의 `start_at`/`end_at`과 상수 둘로 한다. 저장된 `expires_at`은 더 이상 판정에 쓰지 않는다. 웹은 서버가 주는 `SessionStatus`(코드, 열 수 있는 시각)와 `AdminAttendance`(출석 시각)만 그린다.

**Tech Stack:** Spring Boot 3 + JdbcTemplate + Flyway(PostgreSQL), Testcontainers(JUnit 5); Next.js 16 + React + Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-27-check-in-window-design.md`

## Global Constraints

- 상수 둘: `OPEN_BEFORE = Duration.ofMinutes(30)`, `LATE_AFTER = Duration.ofMinutes(15)`. `CheckInService`의 `static final`.
- 상태 값은 `CHECKED_IN` / `LATE` / `MISSED` 셋. `attendance.status`는 `VARCHAR(16)`에 CHECK 제약이 없어 마이그레이션 없이 `LATE`를 저장한다.
- 코드는 `0000`~`9999` 4자리 숫자, `SecureRandom`, 앞자리 0을 유지한다(`String.format("%04d", random.nextInt(10000))`).
- 마이그레이션은 `api/src/main/resources/db/postgresql/`에 쓴다(`db/migration`은 옛 H2용, 쓰지 않는다). `ddl-auto: validate`는 엔티티에 없는 DB 열을 문제 삼지 않으므로 `CheckInSession` 엔티티는 건드리지 않는다.
- 화면 문구는 한국어, 대시(—) 금지, 범위는 `~`. 지각 배지는 중립, 출석 완료 긍정, 미출석 오류.
- 커밋 메시지에 Co-Authored-By나 Claude 표기를 넣지 않는다. 작업 폴더는 CRLF/LF가 섞여 있으니 여러 줄 치환 전에 줄바꿈을 확인한다.
- API 테스트는 Docker(Testcontainers)가 켜져 있어야 돈다: `cd api && ./gradlew test --tests 'kr.ac.jnu.choir.attendance.CheckInFlowTest'`. 웹 테스트: `cd web && npx vitest run src/features/attendance`.
- `CheckInFlowTest`의 시계는 `2026-09-27T10:00:00Z` 고정이다. 모든 시간 경계는 이 값을 기준으로 잡는다.

## Review Focus

- 시작 정확히 15분 뒤(`start_at + 15:00`)에 찍은 출석은 `LATE`다. 경계는 지각 쪽에 붙는다. (Task 1)
- 시작 29분 59초 전에 열기를 누르면 `SESSION_NOT_YET`, 30분 전부터는 열린다. (Task 1)
- 창이 열린 채로 행사 종료 시각을 늦추면 같은 창이 새 종료 시각까지 출석을 받는다. 닫지 않았어도 종료 뒤에는 거절한다. (Task 1)
- 배포 전에 열린 창(코드 열이 NULL)은 어떤 숫자를 넣어도 거절하고, QR 토큰은 그대로 통한다. (Task 2)
- 출석 기록이 없는 단원을 바로 `LATE`로 정정하면 `checked_in_at`에 정정 시각이 들어간다. (Task 3)

---

### Task 1: 행사 시각 기준 창과 지각 판정 (API)

**Files:**
- Modify: `api/src/main/java/kr/ac/jnu/choir/attendance/CheckInService.java`
- Test: `api/src/test/java/kr/ac/jnu/choir/attendance/CheckInFlowTest.java`

**Interfaces:**
- Produces: `private record EventRow(long id, String title, boolean obEligible, Instant startAt, Instant endAt)`; `eventRow()`의 SELECT에 `end_at`을 더한다.
- Produces: `private boolean withinWindow(EventRow event, Instant now)` = `!now.isBefore(event.startAt().minus(OPEN_BEFORE)) && now.isBefore(event.endAt())`.
- Produces: `private boolean sessionOpen(EventRow event, List<SessionRow> active, Instant now)` = `!active.isEmpty() && withinWindow(event, now)`. `state()`, `sessionStatus()`, `checkIn()`, `open()`이 모두 이것을 쓴다. `SessionRow.expiresAt`은 더 이상 읽지 않는다.
- Produces: `historicalMissed(EventRow event, long memberId)` — 시그니처가 `(long eventId, long memberId)`에서 바뀐다. 판정은 `latest.closedAt() != null || !now.isBefore(event.endAt())`.
- Produces: 오류 코드 `SESSION_NOT_YET`(409, "출석 창은 연습 시작 30분 전부터 열 수 있습니다.")와 `CHECK_IN_NOT_YET`(409, "출석은 연습 시작 30분 전부터 할 수 있습니다.").

- [ ] **Step 1: 테스트 보조 함수를 새 시간 규칙에 맞춘다**

`event(boolean obEligible)`의 행사를 `'2026-09-27 09:50:00'`~`'2026-09-27 12:00:00'`으로 바꾼다(시계 10:00은 시작 10분 뒤라 정시). 시작·종료를 받는 보조 함수를 추가한다:

```java
private long eventAt(String start, String end) {
    jdbc.update("INSERT INTO event (title,description,start_at,end_at,ob_eligible,public_visible,created_at,updated_at) "
            + "VALUES ('연습','설명',?,?,FALSE,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))",
            Timestamp.valueOf(start), Timestamp.valueOf(end));
    return jdbc.queryForObject("SELECT MAX(id) FROM event", Long.class);
}
```

`expiredSessionCanBeReopenedButOldCredentialsStayInvalid`는 지운다(옛 코드 무효화는 `qrTokenWorksAndRotationInvalidatesThePreviousToken`이 이미 덮는다). 그 자리에 Step 2의 테스트가 들어간다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```java
@Test void checkInStatusFollowsEventClock() throws Exception {
    Member admin = member("ACTIVE", true);
    Member onTime = member("ACTIVE", false);
    Member late = member("ACTIVE", false);
    long exactlyLate = eventAt("2026-09-27 09:45:00", "2026-09-27 12:00:00"); // 10:00 = 시작 + 15:00
    String code = field(open(exactlyLate, session(admin)), "code");
    assertThat(check(exactlyLate, session(late), code)).isEqualTo(204);
    assertThat(own(exactlyLate, late)).contains("\"status\":\"LATE\"");
    long justStarted = eventAt("2026-09-27 09:46:00", "2026-09-27 12:00:00"); // 시작 + 14:00
    String code2 = field(open(justStarted, session(admin)), "code");
    assertThat(check(justStarted, session(onTime), code2)).isEqualTo(204);
    assertThat(own(justStarted, onTime)).contains("\"status\":\"CHECKED_IN\"");
}

@Test void openingAndCheckInAreRefusedOutsideTheWindow() throws Exception {
    Member admin = member("ACTIVE", true);
    Member active = member("ACTIVE", false);
    long tooEarly = eventAt("2026-09-27 10:30:01", "2026-09-27 12:00:00"); // 열 수 있는 시각 10:00:01
    assertThat(openStatus(tooEarly, session(admin))).isEqualTo(409);
    long openable = eventAt("2026-09-27 10:30:00", "2026-09-27 12:00:00");  // 열 수 있는 시각 10:00:00
    String code = field(open(openable, session(admin)), "code");
    assertThat(check(openable, session(active), code)).isEqualTo(204);
    long ended = eventAt("2026-09-27 08:00:00", "2026-09-27 10:00:00");
    assertThat(openStatus(ended, session(admin))).isEqualTo(409);
}

@Test void checkInBeforeWindowIsRefusedWithItsOwnCode() throws Exception {
    // 창은 열렸지만 아직 인정 시각 전인 경우는 만들 수 없으므로(열기 자체가 30분 전부터),
    // 열린 뒤 행사 시작을 뒤로 미룬 상황으로 흉내 낸다.
    Member admin = member("ACTIVE", true);
    Member active = member("ACTIVE", false);
    long id = event(false);
    String code = field(open(id, session(admin)), "code");
    jdbc.update("UPDATE event SET start_at = '2026-09-27 10:40:00', end_at = '2026-09-27 12:00:00' WHERE id = ?", id);
    var response = mvc.perform(post("/api/v1/events/" + id + "/check-ins").session(session(active))
            .header("X-CSRF-TOKEN", csrf(session(active))).contentType("application/json")
            .content("{\"credential\":\"" + code + "\"}")).andReturn().getResponse();
    assertThat(response.getStatus()).isEqualTo(409);
    assertThat(response.getContentAsString()).contains("CHECK_IN_NOT_YET");
}

@Test void sessionFollowsTheEventEndEvenAfterEdits() throws Exception {
    Member admin = member("ACTIVE", true);
    Member active = member("ACTIVE", false);
    long id = event(false);
    String code = field(open(id, session(admin)), "code");
    jdbc.update("UPDATE event SET end_at = '2026-09-27 09:59:59' WHERE id = ?", id);
    assertThat(check(id, session(active), code)).isEqualTo(409);
    assertThat(own(id, active)).contains("\"status\":\"MISSED\"", "\"checkInOpen\":false");
    jdbc.update("UPDATE event SET end_at = '2026-09-27 12:00:00' WHERE id = ?", id);
    assertThat(own(id, active)).contains("\"status\":\"NOT_OPEN\"", "\"checkInOpen\":true");
    assertThat(check(id, session(active), code)).isEqualTo(204);
}
```

`openStatus(long eventId, MockHttpSession admin)`는 `open()`과 같은 요청을 보내되 상태 코드만 돌려주는 보조 함수로 추가한다. `check()`의 IP 주소 계산은 그대로 쓴다.

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `cd api && ./gradlew test --tests 'kr.ac.jnu.choir.attendance.CheckInFlowTest'`
Expected: 위 네 테스트가 FAIL(지각이 `CHECKED_IN`으로 저장되고, 창 밖 열기가 201로 통과하고, 종료 뒤에도 204).

- [ ] **Step 4: `CheckInService`를 고친다**

- `OPEN_BEFORE`, `LATE_AFTER` 상수와 `EventRow.endAt`, `withinWindow`, `sessionOpen`을 Interfaces대로 만든다.
- `open()`: `withinWindow`가 아니면 `now.isBefore(start - OPEN_BEFORE)`일 때 `SESSION_NOT_YET`, 아니면 `SESSION_CLOSED`. 이미 열린 창이 있으면 지금처럼 `SESSION_ALREADY_OPEN`. `expires_at`에는 `event.endAt()`을 넣는다.
- `rotate()`: 닫힘 판정을 `session.closedAt() != null || !withinWindow(event, now)`로 바꾸고 `IssuedSession.expiresAt`에 `event.endAt()`을 돌려준다(`rotate`도 `lockEvent`의 반환값을 받는다).
- `checkIn()`: 순서는 대상 여부 → 이미 처리 → `now.isBefore(start - OPEN_BEFORE)`면 `CHECK_IN_NOT_YET` → `active.isEmpty() || !now.isBefore(end)`면 `SESSION_CLOSED` → 자격 검사. 저장 상태는 `now.isBefore(start.plus(LATE_AFTER)) ? "CHECKED_IN" : "LATE"`.
- `state()`, `sessionStatus()`, `historicalMissed()`: `expiresAt` 대신 `sessionOpen`/`event.endAt()`.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd api && ./gradlew test --tests 'kr.ac.jnu.choir.attendance.CheckInFlowTest'`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add api/src/main/java/kr/ac/jnu/choir/attendance/CheckInService.java api/src/test/java/kr/ac/jnu/choir/attendance/CheckInFlowTest.java
git commit -m "feat(api): 출석 창을 행사 시작 30분 전부터 종료까지로 묶고 15분 뒤 출석은 지각으로 저장"
```

---

### Task 2: 4자리 숫자 코드와 운영진 화면용 세션 상태 (API)

**Files:**
- Create: `api/src/main/resources/db/postgresql/V6__check_in_session_code.sql`
- Modify: `api/src/main/java/kr/ac/jnu/choir/attendance/CheckInService.java`
- Test: `api/src/test/java/kr/ac/jnu/choir/attendance/CheckInFlowTest.java`

**Interfaces:**
- Consumes: Task 1의 `withinWindow`, `sessionOpen`, `EventRow.endAt`.
- Produces: `check_in_session.code VARCHAR(8)` 열(NULL 허용). `code_hash`는 계속 채운다(NOT NULL 제약 유지).
- Produces: `private record SessionRow(long id, Instant expiresAt, Instant closedAt, String qrHash, String code)`; SELECT 다섯 번째 열이 `code_hash`에서 `code`로 바뀐다.
- Produces: `public record SessionStatus(Long sessionId, Instant expiresAt, boolean open, String code, Instant opensAt)` — `sessionId`는 가장 최근 창(닫힌 것 포함) 또는 null, `expiresAt`은 항상 `event.endAt()`, `open`은 `sessionOpen`, `code`는 열려 있을 때만 평문, `opensAt`은 항상 `start_at - OPEN_BEFORE`.
- Produces: 코드 검증 `credential.equals(session.code())`. QR 토큰은 지금처럼 해시 비교.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`activeMemberChecksInOnceAndMissedAfterClose`의 `hasSize(8)`을 `matches("\\d{4}")`로, `code_hash` 단언을 `SELECT code FROM check_in_session WHERE event_id = ?`가 `code`와 같다는 단언으로 바꾼다. 새 테스트:

```java
@Test void sessionStatusCarriesCodeAndOpeningTime() throws Exception {
    Member admin = member("ACTIVE", true);
    long id = eventAt("2026-09-27 10:20:00", "2026-09-27 12:00:00");
    String before = mvc.perform(get("/api/v1/admin/events/" + id + "/check-in-session").session(session(admin)))
            .andReturn().getResponse().getContentAsString();
    assertThat(before).contains("\"open\":false", "\"code\":null", "\"opensAt\":\"2026-09-27T09:50:00Z\"",
            "\"expiresAt\":\"2026-09-27T12:00:00Z\"");
    String code = field(open(id, session(admin)), "code");
    String during = mvc.perform(get("/api/v1/admin/events/" + id + "/check-in-session").session(session(admin)))
            .andReturn().getResponse().getContentAsString();
    assertThat(during).contains("\"open\":true", "\"code\":\"" + code + "\"");
}

@Test void legacySessionWithoutPlainCodeRefusesEveryCode() throws Exception {
    Member admin = member("ACTIVE", true);
    Member active = member("ACTIVE", false);
    long id = event(false);
    String qrToken = field(open(id, session(admin)), "qrUrl").split("#token=", 2)[1];
    jdbc.update("UPDATE check_in_session SET code = NULL WHERE event_id = ?", id);
    assertThat(check(id, session(active), "0000")).isEqualTo(409);
    assertThat(check(id, session(active), qrToken)).isEqualTo(204);
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd api && ./gradlew test --tests 'kr.ac.jnu.choir.attendance.CheckInFlowTest'`
Expected: 새 테스트와 고친 단언이 FAIL(`code` 열 없음, 응답에 `code`/`opensAt` 없음, 코드 길이 8).

- [ ] **Step 3: 마이그레이션과 서비스를 고친다**

`V6__check_in_session_code.sql`:

```sql
ALTER TABLE check_in_session ADD COLUMN code VARCHAR(8);
```

`CheckInService`: `newCode()`를 4자리 숫자로, `ALPHABET`을 지운다. `open()`/`rotate()`의 INSERT/UPDATE에 `code` 열을 더한다. `activeSession`/`currentSession`/`sessionRow`를 새 `SessionRow`에 맞춘다. `checkIn()`의 코드 비교를 `session.code() != null && session.code().equals(credential)`로 바꾸고(QR 해시 비교는 유지), `sessionStatus()`를 Interfaces의 새 `SessionStatus`로 바꾼다. 가장 최근 창을 읽는 쿼리는 `activeSession`과 같되 `closed_at IS NULL` 조건이 없다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd api && ./gradlew test`
Expected: 전부 PASS(다른 테스트 클래스가 `SessionStatus` 필드를 보지 않는지 함께 확인).

- [ ] **Step 5: 커밋**

```bash
git add api/src/main/resources/db/postgresql/V6__check_in_session_code.sql api/src/main/java/kr/ac/jnu/choir/attendance/CheckInService.java api/src/test/java/kr/ac/jnu/choir/attendance/CheckInFlowTest.java
git commit -m "feat(api): 출석 코드를 4자리 숫자 평문으로 저장하고 운영진 조회에 코드와 열리는 시각을 싣음"
```

---

### Task 3: 지각 정정과 출석 시각 응답 (API)

**Files:**
- Modify: `api/src/main/java/kr/ac/jnu/choir/attendance/AttendanceController.java:102`
- Modify: `api/src/main/java/kr/ac/jnu/choir/attendance/CheckInService.java`
- Test: `api/src/test/java/kr/ac/jnu/choir/attendance/CheckInFlowTest.java`

**Interfaces:**
- Produces: `CorrectionInput.status` 정규식 `CHECKED_IN|LATE|MISSED`.
- Produces: `public record AdminAttendance(Long memberId, String name, String part, Integer cohort, String status, Instant checkedInAt, Instant correctedAt)`; 둘 다 기록이 없으면 null.
- Produces: `private record AttendanceRow(String status, Instant checkedInAt, Instant correctedAt)`와 `private AttendanceRow attendanceRow(long eventId, long memberId)`(없으면 null). 기존 `attendance()`는 이것의 `status`를 돌려준다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```java
@Test void adminCanCorrectToLateAndSeesTimes() throws Exception {
    Member admin = member("ACTIVE", true);
    Member active = member("ACTIVE", false);
    Member absent = member("ACTIVE", false);
    long id = event(false);
    String code = field(open(id, session(admin)), "code");
    assertThat(check(id, session(active), code)).isEqualTo(204);
    MockHttpSession adminSession = session(admin);
    assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + absent.getId())
            .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
            .content("{\"status\":\"LATE\",\"reason\":\"늦게 와서 직접 확인\"}")).andReturn().getResponse().getStatus()).isEqualTo(204);
    String list = mvc.perform(get("/api/v1/admin/events/" + id + "/attendance").session(adminSession))
            .andReturn().getResponse().getContentAsString();
    assertThat(list).contains("\"memberId\":" + active.getId() + ",", "\"status\":\"CHECKED_IN\",\"checkedInAt\":\"2026-09-27T10:00:00Z\",\"correctedAt\":null")
            .contains("\"memberId\":" + absent.getId() + ",", "\"status\":\"LATE\",\"checkedInAt\":\"2026-09-27T10:00:00Z\",\"correctedAt\":\"2026-09-27T10:00:00Z\"");
    assertThat(own(id, absent)).contains("\"status\":\"LATE\"");
    assertThat(myList(absent)).contains("\"eventId\":" + id + ",", "\"status\":\"LATE\"");
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd api && ./gradlew test --tests 'kr.ac.jnu.choir.attendance.CheckInFlowTest'`
Expected: FAIL(정정이 400, 응답에 `checkedInAt` 없음).

- [ ] **Step 3: 컨트롤러와 서비스를 고친다**

정규식에 `LATE`를 더한다. `correct()`에서 `checked_in_at`을 채우는 조건을 `Set.of("CHECKED_IN", "LATE").contains(newStatus)`로 바꾼다. `adminList()`가 `attendanceRow()`를 한 번 더 읽어 `AdminAttendance`에 시각을 싣는다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd api && ./gradlew test`
Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add api/src/main/java/kr/ac/jnu/choir/attendance/
git add api/src/test/java/kr/ac/jnu/choir/attendance/CheckInFlowTest.java
git commit -m "feat(api): 출석 정정에 지각을 더하고 운영진 명단에 출석·정정 시각을 실음"
```

---

### Task 4: 단원 화면의 지각 상태와 4자리 입력칸 (web)

**Files:**
- Modify: `web/src/features/attendance/attendance.ts`
- Modify: `web/src/features/attendance/CheckInPanel.tsx:139-146`
- Modify: `web/src/features/attendance/MyAttendancePage.tsx:27`, `web/src/features/event/EventCalendar.tsx:234`, `web/src/features/event/EventPage.tsx:68`
- Test: `web/src/features/attendance/CheckInPanel.test.tsx`, `web/src/features/attendance/attendance.test.ts`(새 파일)

**Interfaces:**
- Consumes: Task 1~3의 응답 모양(`LATE` 상태, `SessionStatus.code/opensAt`, `AdminAttendance.checkedInAt/correctedAt`).
- Produces (`attendance.ts`): `AttendanceStatus`에 `"LATE"`; `attendanceLabel.LATE = "지각"`; `export function attendanceTone(status: AttendanceStatus): "positive" | "negative" | "neutral"`(CHECKED_IN 긍정, MISSED 오류, 그 밖은 중립); `SessionStatus`에 `code: string | null; opensAt: string`; `AdminAttendance`에 `checkedInAt: string | null; correctedAt: string | null`; `correctAttendance(..., status: "CHECKED_IN" | "LATE" | "MISSED", ...)`.
- Produces: `export const checkedStatuses: AttendanceStatus[] = ["CHECKED_IN", "LATE"]` — 입력칸을 잠그는 기준.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`attendance.test.ts`:

```ts
import { expect, test } from "vitest";
import { attendanceLabel, attendanceTone, memberAttendanceLabel } from "./attendance";

test("지각은 중립 배지에 '지각'으로 보입니다", () => {
  expect(attendanceLabel.LATE).toBe("지각");
  expect(attendanceTone("LATE")).toBe("neutral");
  expect(attendanceTone("CHECKED_IN")).toBe("positive");
  expect(attendanceTone("MISSED")).toBe("negative");
  expect(memberAttendanceLabel({ eventId: 1, eventTitle: "연습", startAt: "2026-10-28T10:00:00Z", status: "LATE", checkInOpen: true })).toBe("지각");
});
```

`CheckInPanel.test.tsx`에 추가(기존 테스트의 렌더 보조 함수와 모킹을 그대로 쓴다):

```ts
test("코드 입력칸은 숫자 4자리만 받고 지각 상태에서도 잠깁니다", async () => {
  // status LATE로 렌더
  const input = await screen.findByLabelText("운영진이 알려준 출석 코드");
  expect(input).toHaveAttribute("maxlength", "4");
  expect(input).toHaveAttribute("inputmode", "numeric");
  expect(input).toBeDisabled();
  expect(screen.getByText("지각")).toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd web && npx vitest run src/features/attendance`
Expected: 새 테스트 FAIL(`attendanceTone` 없음, maxlength 8, LATE에서 입력 가능).

- [ ] **Step 3: 구현한다**

`attendance.ts`를 Interfaces대로 바꾼다. `CheckInPanel.tsx`의 입력칸은 `maxLength={4} inputMode="numeric" pattern="[0-9]{4}" autoCapitalize="off"`, 제출 전 `.toUpperCase()`를 지우고, `disabled`/제출 막기 조건의 `status?.status === "CHECKED_IN"`을 `checkedStatuses.includes(status.status)`로 바꾼다. 네 곳의 `tone={... ? "positive" : ... ? "negative" : "neutral"}`을 `tone={attendanceTone(x.status)}`로 바꾼다. `errorMessage`의 `SESSION_CLOSED` 문구는 "출석 창이 열리지 않았거나 연습이 끝났습니다."로 바꾸고, `CHECK_IN_NOT_YET`은 기본 분기가 서버 문구를 그대로 보여 주므로 따로 두지 않는다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd web && npx vitest run src/features/attendance src/features/event && npx tsc --noEmit`
Expected: 전부 PASS, 타입 오류 없음(`AdminAttendancePanel`의 `correctAttendance` 호출은 Task 5 전까지 두 상태만 넘기므로 통과).

- [ ] **Step 5: 커밋**

```bash
git add web/src/features/attendance/ web/src/features/event/EventCalendar.tsx web/src/features/event/EventPage.tsx
git commit -m "feat(web): 지각 상태 배지와 4자리 숫자 출석 코드 입력칸"
```

---

### Task 5: 운영진 출석 관리 화면과 운영 문서 (web, docs)

**Files:**
- Modify: `web/src/features/attendance/AdminAttendancePanel.tsx`
- Modify: `web/src/features/event/events.ts`(`seoulTime` 추가)
- Modify: `docs/operations.md:38-44`, `CONTEXT.md`(출석 창 설명 줄)
- Test: `web/src/features/attendance/AdminAttendancePanel.test.tsx`

**Interfaces:**
- Consumes: Task 4의 `attendanceTone`, `checkedStatuses`, 새 `SessionStatus`/`AdminAttendance` 타입, `correctAttendance`의 `LATE`.
- Produces: `export function seoulTime(value: string): string` in `events.ts` — `seoulDateTime`과 같은 포맷에서 시각만("오후 6:03").
- 화면 규칙(스펙 "운영진 출석 관리 화면"):
  - 안내 문구: "출석 창은 연습 시작 30분 전부터 열 수 있고 연습이 끝나면 닫힙니다. 시작 15분 뒤부터 찍은 출석은 지각으로 기록됩니다. 재발급하면 이전 QR과 코드는 바로 쓸 수 없습니다." 파트연습 경고는 유지.
  - `!session.open`: 주요 버튼 하나. 라벨은 `session.sessionId ? "다시 열기" : "출석 받기"`. `Date.now() < new Date(session.opensAt)`이면 `disabled`이고 옆에 `출석 창은 {seoulDateTime(session.opensAt)}부터 열 수 있습니다.`를 보인다. 열 수 있는 시각이 되면 다시 그린다(`opensAt - now`만큼 `setTimeout`).
  - `session.open`: `입력 코드: {session.code}`를 `issued`와 무관하게 보인다. QR 이미지는 지금처럼 `issued`가 있을 때만. 현재 창 문구는 `연습 끝 {seoulDateTime(session.expiresAt)}까지`. 새로고침 안내는 "새로고침하면 QR은 사라지지만 코드는 그대로 보입니다."
  - 단원 행: `<StatusBadge tone={attendanceTone(member.status)}>` 뒤에 `member.checkedInAt`이 있으면 `seoulTime(member.checkedInAt)`, `member.correctedAt`이 있으면 "정정됨"을 작은 글자로 붙인다.
  - 정정 버튼 셋: 출석·지각·미출석. 각 버튼은 `member.status`가 그 값이면 `disabled`.

- [ ] **Step 1: 기존 테스트의 모킹을 새 타입에 맞추고 실패하는 테스트를 쓴다**

기존 `getCheckInSession`/`openCheckIn` 모킹 값에 `code`, `opensAt`을 더하고 "출석 창 열기" 문구를 "출석 받기"로 바꾼다. 새 테스트:

```ts
test("열 수 있는 시각 전에는 출석 받기 버튼을 끄고 시각을 알려 줍니다", async () => {
  // getCheckInSession → { sessionId: null, expiresAt: "2026-10-28T12:00:00Z", open: false, code: null, opensAt: 지금 + 1시간 }
  const button = await screen.findByRole("button", { name: "출석 받기" });
  expect(button).toBeDisabled();
  expect(screen.getByText(/부터 열 수 있습니다/)).toBeInTheDocument();
});

test("열린 창의 코드는 새로고침 뒤에도 서버에서 받아 보여 줍니다", async () => {
  // getCheckInSession → { sessionId: 7, expiresAt: "2026-10-28T12:00:00Z", open: true, code: "0427", opensAt: 과거 }
  expect(await screen.findByText("0427")).toBeInTheDocument();
  expect(screen.getByText(/연습 끝 .*까지/)).toBeInTheDocument();
});

test("단원 행에 출석 시각과 정정 표시를 붙이고 지각으로 정정할 수 있습니다", async () => {
  // getAdminAttendance → [{ memberId: 1, name: "박예영", part: "ALTO", cohort: 2, status: "LATE", checkedInAt: "2026-10-28T09:21:00Z", correctedAt: null },
  //                       { memberId: 2, name: "최재원", part: null, cohort: null, status: "MISSED", checkedInAt: null, correctedAt: "2026-10-28T11:00:00Z" }]
  expect(await screen.findByText("지각")).toBeInTheDocument();
  expect(screen.getByText("오후 6:21")).toBeInTheDocument();
  expect(screen.getByText("정정됨")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("최재원 정정 이유"), { target: { value: "늦게 옴" } });
  fireEvent.click(screen.getByRole("button", { name: "최재원 지각으로 정정" }));
  await waitFor(() => expect(attendance.correctAttendance).toHaveBeenCalledWith(3, 2, "LATE", "늦게 옴"));
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd web && npx vitest run src/features/attendance/AdminAttendancePanel.test.tsx`
Expected: 새 테스트 셋 FAIL.

- [ ] **Step 3: 화면을 구현한다**

Interfaces의 화면 규칙대로 `AdminAttendancePanel.tsx`를 고치고 `events.ts`에 `seoulTime`을 더한다. `closedIfExpired`와 만료 타이머는 `expiresAt`이 행사 종료 시각이므로 그대로 둔다.

- [ ] **Step 4: 테스트와 타입 검사를 통과시킨다**

Run: `cd web && npx vitest run && npx tsc --noEmit && npm run lint`
Expected: 전부 PASS.

- [ ] **Step 5: 운영 문서를 고친다**

`docs/operations.md` 38행의 "QR과 입력 코드는 10분 동안 유효하며"를 "출석 창은 연습 시작 30분 전부터 열 수 있고 연습이 끝나면 닫히며, 시작 15분 뒤부터 찍은 출석은 지각으로 기록되고"로, 코드 설명에 "입력 코드는 4자리 숫자이며 출석 관리 화면에서 언제든 다시 볼 수 있습니다"를 더한다. 40행의 "유효 시간이 지나면"은 "연습이 끝나면"으로, 44행의 "출석 창이 이미 닫혔다면"은 그대로 둔다. `CONTEXT.md`에서 출석 창을 설명하는 줄도 같은 뜻으로 맞춘다.

- [ ] **Step 6: 커밋**

```bash
git add web/src/features/attendance/AdminAttendancePanel.tsx web/src/features/attendance/AdminAttendancePanel.test.tsx web/src/features/event/events.ts docs/operations.md CONTEXT.md
git commit -m "feat(web): 출석 관리 화면에 출석 받기 버튼, 현재 코드, 출석 시각, 지각 정정을 둠"
```
