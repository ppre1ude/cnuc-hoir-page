# 세션 module 설계

작성일: 2026-10-04. 용어는 `CONTEXT.md`, 리다이렉트 소유는 `docs/adr/0001-transport-owns-session-redirects.md`를 따릅니다.

## 목적

회원·운영진 화면 11곳이 각자 `/auth/me`를 받아 승인 여부를 확인하고, 리다이렉트하고, 권한을 가립니다. 거부 화면은 네 가지로 갈리고, 운영진 페이지는 한 번 열 때 `/auth/me`를 세 번 받으며, 페이지를 넘기거나 달을 바꿀 때마다 다시 받습니다. 세션을 받는 일과 대기·실패·거부 화면을 한 module로 모아, 페이지는 "내 스켈레톤과 내 권한"만 적게 합니다.

## 구성

### 요청 transport (`web/src/lib/api.ts`)

- 리다이렉트는 `redirectTo(path)` 하나로 합니다. 전체 새로고침 이동입니다.
- `/auth/*`가 아닌 요청에서 401이면 `/login`, 403 `APPROVAL_REQUIRED`면 `/application-status`로 보냅니다. 지금 동작과 같습니다.
- 403 `PERMISSION_REQUIRED`를 받으면 `onPermissionDenied(listener)`로 등록된 함수를 부릅니다. 리다이렉트하지 않습니다.

### 세션 provider (`web/src/features/auth/SessionProvider.tsx`)

- 회원 영역 레이아웃과 운영진 영역 레이아웃이 감쌉니다. 운영진 영역은 `requireStaff`를 켭니다.
- 마운트 때 `/auth/me`를 한 번 받습니다. 결과에 따라 다음과 같이 처리합니다.
  - 401: `/login`으로 보냅니다.
  - 승인되지 않은 계정: `/application-status`로 보냅니다.
  - `requireStaff`인데 운영진이 아님: `/dashboard`로 보냅니다.
  - 그 밖의 실패: 상태를 실패로 둡니다.
- 다시 받는 경우: 다시 시도 버튼, 403 `PERMISSION_REQUIRED` 알림, 자기 직책을 바꾼 직후. 이미 세션이 있으면 다시 받는 동안 기존 세션을 유지하고, 다시 받다 실패해도 기존 세션을 유지합니다. 페이지 이동 때는 다시 받지 않습니다. 회원 영역과 운영진 영역을 오갈 때는 레이아웃이 바뀌므로 한 번 받습니다.
- 늦게 도착한 응답은 버립니다.
- 테스트용으로 `initialSession`을 받으면 요청 없이 준비 상태로 시작합니다.
- 읽는 방법은 둘입니다. `useSessionState()`는 `{ status, session, refresh }`를 돌려주며 헤더와 페이지 문지기가 씁니다. `useSession()`은 준비된 세션을 돌려주며 페이지 문지기 안의 본문이 씁니다. 세션이 없으면 예외를 던집니다.

### 페이지 문지기 (`web/src/features/auth/PageGate.tsx`)

각 라우트 페이지가 본문을 감싸고 `skeleton`과 선택적 `permission`을 넘깁니다.

| 상태 | 화면 |
| --- | --- |
| 대기 | 그 페이지의 스켈레톤. 화면 읽기 프로그램에는 "불러오는 중입니다." |
| 대기 3초 경과 | 스켈레톤 위에 오선·음표 대기 그림과 "서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요." |
| 실패 | "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."와 다시 시도 버튼. 자동 재시도 없음 |
| 권한 없음 | "이 기능을 쓸 권한이 없습니다."와 "일정으로 가기" 링크 |
| 준비 | 본문 |

### 대기 그림 (`web/src/features/auth/WaitingScore.tsx`)

첫 화면의 흐르는 오선과 음표를 줄인 SVG입니다. 음표 하나가 오선을 따라 천천히 오갑니다. 새 일러스트나 외부 파일을 쓰지 않습니다.

### 스켈레톤

- 공통 UI에 `Skeleton`(막대·블록)과 `SkeletonRows`(목록 행)를 둡니다. 움직임은 투명도 펄스입니다.
- 각 기능 폴더가 자기 화면의 스켈레톤을 화면 옆에 만듭니다. 예: `EventCalendarSkeleton`.
- 세션을 받은 뒤 각 화면이 자기 데이터를 받는 동안에도 "불러오는 중" 문구 대신 같은 모양의 행 스켈레톤을 씁니다. 화면 읽기 프로그램에는 기존 문구를 그대로 알립니다. 데이터를 받는 코드는 바꾸지 않습니다.
- 모션 줄이기 설정에서는 펄스와 대기 그림이 멈춥니다.

### 헤더

회원 헤더와 운영진 하위 메뉴는 세션을 기다리지 않고 바로 그립니다. 이름과 "운영진" 메뉴, 권한별 하위 메뉴는 세션이 오면 나타납니다. 헤더는 더 이상 리다이렉트하지 않습니다.

## 라우트와 권한

| 라우트 | 본문 | 권한 |
| --- | --- | --- |
| `/dashboard` | 일정 대시보드 | 없음 |
| `/events/[id]` | 행사 상세 | 없음 |
| `/events/[id]/check-in` | 현장 출석 | 없음 |
| `/notices` | 공지 | 없음 |
| `/attendance` | 내 출석 | 없음 |
| `/admin/members` | 단원 계정 | `VIEW_MEMBERS` |
| `/admin/applications` | 가입 승인 | `APPROVE_APPLICATIONS` |
| `/admin/notices` | 공지 관리 | `MANAGE_EVENTS` |
| `/admin/events` | 행사 관리 | `MANAGE_EVENTS` |
| `/admin/events/[id]/attendance` | 출석 관리 | `MANAGE_EVENTS` |

로그인, 계정 연결, 가입 상태 화면은 범위 밖입니다. 이 화면들은 승인 전 단계라 지금처럼 `getSession()`을 직접 씁니다.

## 테스트

- `web/src/test/session.tsx`의 `sessionFixture(overrides)`와 `renderWithSession(ui, session)`으로 페이지에 세션을 넣습니다. 페이지 테스트는 `../auth/session`을 목으로 잡지 않습니다.
- 리다이렉트, 다시 받기, 늦은 응답, 실패는 provider 테스트에서, 대기·3초·실패·거부 화면은 문지기 테스트에서 한 번씩 검증합니다.
- 운영진 라우트마다 권한이 없는 세션으로 그렸을 때 거부 문구가 나오는지 확인해 라우트와 권한의 짝을 고정합니다.

## 하지 않는 것

- 서버 레이아웃에서 세션을 미리 받는 방식. provider의 초기값만 바꾸면 나중에 옮길 수 있습니다.
- 데이터 로딩 구조 정리(아키텍처 리뷰의 후보 2)와 목록 페이지 module(후보 3).
- 회원 영역과 운영진 영역을 하나의 레이아웃으로 합치는 폴더 재구성.
