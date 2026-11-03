# 가입 승인 알림 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가입 승인 권한이 있는 운영진이 로그인 뒤 어느 화면에 있어도 승인 대기 인원을 띠로 보고 한 번에 가입 승인 화면으로 가게 한다.

**Architecture:** 단원 레이아웃과 운영진 레이아웃이 메뉴 다음에 같은 `ApprovalReminder` 컴포넌트를 둔다. 컴포넌트는 세션 권한을 보고 기존 `getApplications(0)`의 `total`을 읽어 띠를 그리며, 경로 변경과 쓰기 완료와 1분 주기에 다시 받는다. 쓰기 완료 알림은 `lib/api.ts`가 캐시를 비우는 자리에서 함께 보낸다. 서버는 바꾸지 않는다.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-03-approval-reminder-design.md`

## Global Constraints

- 화면 문구에 대시(—)와 가운뎃점(·)을 쓰지 않는다. 커밋 메시지는 한국어, Claude 표기 없음.
- 새 색과 토큰을 만들지 않는다. 띠 스타일은 홈 출석 띠(`.checkInBanner`)의 규칙을 공통으로 옮겨 쓴다.
- 새 API 없음. `GET /admin/applications?status=APPROVAL_PENDING&page=0&size=20`의 `total`만 쓴다.
- 띠는 `can(session, "APPROVE_APPLICATIONS")`일 때만, 대기 1명 이상일 때만, 세 경로(`/admin/applications`, `/events/<id>/check-in`, `/admin/events/<id>/attendance`) 밖에서만 그린다.
- 폭은 `--layout-wide`, 1분 주기 요청만 `cache: "reload"`.

## Review Focus

1. 로그아웃(`POST /auth/logout`) 직후 띠가 다시 요청해 401로 로그인 화면에 튕기면 안 된다. Task 1의 `/auth/` 제외 테스트가 잡는다.
2. 서버가 자고 있어 요청이 실패해도 띠는 조용히 없어야 하고 오류 문구를 띄우면 안 된다. Task 2의 실패 테스트가 잡는다.
3. `/events/12`(일정 상세)에서는 보이고 `/events/12/check-in`에서만 숨어야 한다. 정규식이 느슨하면 둘 다 숨긴다. Task 2의 경로 테스트가 둘을 함께 본다.
4. 권한이 사라진 세션(직책 해제 뒤 세션 갱신)에서는 띠와 주기 요청이 함께 멈춰야 한다. Task 2의 권한 없음 테스트에서 `getApplications`가 불리지 않음을 함께 확인한다.
5. 요청이 끝나기 전에 레이아웃이 바뀌어 컴포넌트가 사라지면 늦은 응답이 상태를 건드리면 안 된다. Task 2 구현의 `alive` 플래그, 테스트는 unmount 뒤 응답 해소로 확인한다.

---

### Task 1: 쓰기 완료 알림 `onWriteCompleted`

**Files:**
- Modify: `web/src/lib/api.ts` (쓰기 요청 분기 `promise.then(clearRequestCache, clearRequestCache)` 근처)
- Test: `web/src/lib/api.test.ts`

**Interfaces:**
- Produces: `export function onWriteCompleted(listener: () => void): () => void` (구독 해제 함수를 돌려준다). GET이 아닌 요청이 끝나면(성공, 실패 모두) 캐시를 비운 뒤 모든 구독자를 부른다. `path`가 `/auth/`로 시작하는 쓰기는 캐시만 비우고 구독자를 부르지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성** (`api.test.ts`, 기존 `onPermissionDenied` 테스트 옆)

```ts
test("쓰기 요청이 끝나면 구독자에게 알리고, 인증 쓰기는 알리지 않습니다", async () => {
  const listener = vi.fn();
  const unsubscribe = onWriteCompleted(listener);
  stubFetch(/* 200 응답 두 번, 500 응답 한 번을 차례로 */);
  await apiRequest("/admin/x", { method: "POST" });
  expect(listener).toHaveBeenCalledTimes(1);
  await apiRequest("/admin/x", { method: "POST" }).catch(() => undefined); // 500도 알림
  expect(listener).toHaveBeenCalledTimes(2);
  await apiRequest("/auth/logout", { method: "POST" });
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  await apiRequest("/admin/x", { method: "POST" });
  expect(listener).toHaveBeenCalledTimes(2);
});
```

기존 파일의 fetch 스텁 방식(CSRF 응답 포함)을 그대로 따른다.

- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/lib/api.test.ts` Expected: FAIL, `onWriteCompleted is not a function`
- [ ] **Step 3: 구현** `permissionDeniedListeners`와 같은 꼴의 `Set`을 두고, 쓰기 분기의 `clearRequestCache` 자리를 "캐시 비우기, 그리고 `/auth/`가 아니면 구독자 호출" 함수로 바꾼다. 주석 한 줄로 `/auth/`를 빼는 이유(로그아웃 뒤 재요청이 401을 만든다)를 적는다.
- [ ] **Step 4: 통과 확인** Run: `npx vitest run src/lib/api.test.ts` Expected: PASS
- [ ] **Step 5: 커밋** `git add web/src/lib/api.ts web/src/lib/api.test.ts && git commit -m "feat(web): 쓰기 요청이 끝나면 알리는 onWriteCompleted를 더함"`

### Task 2: `ApprovalReminder` 컴포넌트와 공통 띠 스타일

**Files:**
- Modify: `web/src/components/ui/ui.module.css` (`.banner`, `.banner p`, `.banner strong`, `.banner span`, 760px 이하 `.banner > a { width: 100% }` 추가)
- Modify: `web/src/features/event/EventCalendar.module.css:8-11, 137-138` (`.checkInBanner`를 `composes: banner from "../../components/ui/ui.module.css"` + `margin-bottom`만 남기고, 모바일 `> a` 규칙 삭제)
- Modify: `web/src/features/member/adminMembers.ts` (`getApplications`)
- Create: `web/src/features/member/ApprovalReminder.tsx`, `web/src/features/member/ApprovalReminder.module.css`
- Test: `web/src/features/member/ApprovalReminder.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `onWriteCompleted`, `lib/poll.ts`의 `pollWhileVisible(load, intervalMs)`, `useSessionState()`, `can()`, `ActionLink`.
- Produces: `export function ApprovalReminder(): ReactElement | null`. `getApplications(page = 0, init?: Pick<RequestInit, "cache">): Promise<ApplicationPage>` (둘째 인자를 `apiRequest`에 그대로 넘긴다).

- [ ] **Step 1: 실패하는 테스트 작성** (`ApprovalReminder.test.tsx`). `MemberNavigation.test.tsx`처럼 `next/navigation`의 `usePathname`을 `nav.pathname`으로 모킹하고, `./adminMembers`의 `getApplications`, `../../lib/api`의 `onWriteCompleted`(원본 유지 + `vi.fn()`으로 교체), `../../lib/poll`의 `pollWhileVisible`을 모킹한다. 승인 권한 세션은 `sessionFixture({ permissions: ["APPROVE_APPLICATIONS"] })`.

```ts
test("승인 대기가 있으면 인원과 승인하러 가기 링크를 보입니다", async () => {
  getApplications → { items: [], page: 0, size: 20, total: 3 }
  renderWithSession(<ApprovalReminder />, approver);
  const region = await screen.findByRole("region", { name: "가입 승인 알림" });
  expect(region).toHaveTextContent("가입 승인을 기다리는 단원이 3명 있어요.");
  expect(screen.getByRole("link", { name: "승인하러 가기" })).toHaveAttribute("href", "/admin/applications");
});
test("대기가 0명이면 아무것도 그리지 않습니다")           // total: 0 → container.firstChild === null (요청은 한 번 나감)
test("권한이 없으면 요청도 보내지 않고 그리지 않습니다")    // sessionFixture() → getApplications 호출 0회
test("가입 승인, 현장 출석, 출석 관리 화면에서는 숨기고 일정 상세에서는 보입니다")
  // "/admin/applications", "/events/12/check-in", "/admin/events/12/attendance" → null, 호출 0회
  // "/events/12" → 보임
test("요청이 실패하면 조용히 비워 둡니다")               // mockRejectedValue → null, 오류 role 없음
test("쓰기가 끝나면 다시 받아 숫자를 바꿉니다")           // onWriteCompleted에 넘어온 listener를 꺼내 호출, total 3 → 1로 바뀜
test("경로가 바뀌면 다시 받습니다")                      // nav.pathname 바꾸고 rerender → 호출 2회
test("1분 주기 요청은 기억을 건너뜁니다")                 // pollWhileVisible 모킹에 넘어온 load를 호출 → getApplications(0, { cache: "reload" }), intervalMs 60000
test("사라진 뒤 도착한 응답은 상태를 건드리지 않습니다")   // 지연 promise, unmount 후 resolve → 콘솔 오류 없음
```

- [ ] **Step 2: 실패 확인** Run: `npx vitest run src/features/member/ApprovalReminder.test.tsx` Expected: FAIL, 모듈 없음
- [ ] **Step 3: 공통 스타일** `ui.module.css`에 `.banner` 묶음을 두고(`.checkInBanner`의 네 규칙을 그대로 옮기되 `margin-bottom`은 빼고), 760px 미디어 블록에 `.banner > a { width: 100%; }`를 더한다. `EventCalendar.module.css`의 `.checkInBanner`는 `composes: banner from "../../components/ui/ui.module.css"; margin-bottom: var(--space-6);`만 남기고 `p`, `strong`, `span`, 모바일 `> a` 규칙을 지운다(모바일 `margin-bottom: var(--space-5)`는 유지).
- [ ] **Step 4: `getApplications`에 둘째 인자 추가** 시그니처는 Interfaces대로. 다른 호출자는 바뀌지 않는다.
- [ ] **Step 5: 컴포넌트 구현** `ApprovalReminder.tsx`(`"use client"`):
  - `const HIDDEN = [/^\/admin\/applications$/, /^\/events\/\d+\/check-in$/, /^\/admin\/events\/\d+\/attendance$/]`
  - `allowed = can(session, "APPROVE_APPLICATIONS")`, `hidden = HIDDEN.some((pattern) => pattern.test(pathname))`
  - `useEffect` 의존성 `[allowed, hidden, pathname]`: `allowed && !hidden`일 때만 `load(fresh)`를 정의해 처음 한 번 부르고, `onWriteCompleted(() => load())`와 `pollWhileVisible(() => load(true), 60_000)`을 구독하며, 정리에서 `alive = false`와 두 구독 해제. `load`는 실패를 `catch(() => undefined)`로 삼킨다. `fresh`면 `{ cache: "reload" }`.
  - 렌더: `!allowed || hidden || count === 0`이면 `null`. 아니면 `<section aria-label="가입 승인 알림" className={styles.reminder}><p><strong>가입 승인을 기다리는 단원이 {count}명 있어요.</strong></p><ActionLink variant="primary" href="/admin/applications">승인하러 가기</ActionLink></section>`.
  - `ApprovalReminder.module.css`: `.reminder { composes: banner from "../../components/ui/ui.module.css"; width: min(calc(100% - var(--page-gutter) * 2), var(--layout-wide)); margin: var(--page-top) auto calc(var(--space-4) - var(--page-top)); }` 아래 여백을 음수로 두어 본문의 `--page-top`과 합쳐 띠와 제목 사이가 `--space-4`가 되게 한다. 주석 한 줄로 이유를 적는다.
- [ ] **Step 6: 통과 확인** Run: `npx vitest run src/features/member/ApprovalReminder.test.tsx src/features/event` Expected: PASS (출석 띠 테스트 포함)
- [ ] **Step 7: 커밋** `git commit -m "feat(web): 가입 승인 대기 인원을 알리는 띠 컴포넌트를 더함"`

### Task 3: 레이아웃 배치와 문서

**Files:**
- Modify: `web/src/app/(member)/layout.tsx` (`<MemberNavigation />` 다음 줄), `web/src/app/(admin)/layout.tsx` (`<AdminNavigation />` 다음 줄)
- Modify: `docs/design-system.md` (공통 컴포넌트 절에 띠 스타일 공유 한 줄, 적용 검증 기록에 "가입 승인 알림 (2026-11-03)" 절), `docs/operations.md` (가입 신청자 처리 문단에 띠 한 줄)
- Add: `docs/superpowers/specs/2026-11-03-approval-reminder-design.md`, `docs/superpowers/plans/2026-11-03-approval-reminder.md`

**Interfaces:**
- Consumes: Task 2의 `ApprovalReminder`.

- [ ] **Step 1: 두 레이아웃에 `<ApprovalReminder />` 추가.** 테스트는 두지 않는다(레이아웃은 서버 컴포넌트이고 컴포넌트 테스트가 동작을 다 덮는다).
- [ ] **Step 2: 전체 확인** Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint` Expected: vitest 전부 PASS, tsc 오류 0, eslint는 main에 이미 있던 `MemberAccountManager.tsx`의 ref 오류 1건만(이 PR에서 건드리지 않음).
- [ ] **Step 3: 화면 확인** 모의 `/auth/me`(승인 권한)와 `/admin/applications`(total 3)로 개발 서버를 띄워 홈과 운영진 화면을 1440px, 390px에서 캡처한다. 가입 승인 화면에서 띠가 없음, 가로 넘침 없음을 확인하고 결과를 `docs/design-system.md` 검증 기록에 한 줄로 적는다.
- [ ] **Step 4: 문서 수정과 커밋** `git add web/src/app docs && git commit -m "feat(web): 단원과 운영진 레이아웃에 가입 승인 알림 띠를 두고 문서에 반영함"`
- [ ] **Step 5: 푸시와 PR** 브랜치 `feat/approval-reminder`를 올리고 PR을 연다. 제목 "feat(web): 운영진에게 가입 승인 대기 인원을 띠로 알림". 본문은 스펙 요약, 확인 기준, 테스트 결과. 머지는 사용자가 한다.
