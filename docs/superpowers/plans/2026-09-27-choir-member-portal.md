# 전남대학교 합창단 회원 포털 구현 계획

> **구현 담당자:** 승인된 [설계 문서](../specs/2026-09-27-choir-member-portal-design.md)를 먼저 읽고, 각 작업의 체크박스를 순서대로 수행합니다. 구현 시 `superpowers:executing-plans` 또는 명시적으로 위임받은 경우 `superpowers:subagent-driven-development`를 사용합니다. 각 작업은 테스트와 검토를 마친 뒤 별도 커밋으로 남깁니다.

**목표:** 가입 승인된 합창단원이 일정 중심 화면에서 공지·행사·본인 출석을 확인하고, 운영진이 회원·공지·행사·출석을 관리하는 웹 포털을 구현합니다.

**구조:** `web/`의 Next.js가 화면과 동일 출처의 `/api/v1` 호출을 담당하고, `api/`의 Spring Boot가 인증·권한·업무 규칙을 담당합니다. MySQL의 버전별 마이그레이션으로 데이터를 관리합니다. 공개 온보딩의 시각 디자인과 행사 아카이브·공개 행사 API는 후속 설계 범위입니다.

**기술:** Node.js 24, Next.js 16.3.6·TypeScript, Java 21, Spring Boot 4.1.1·Spring Security·Spring Session JDBC·Flyway, MySQL 8.4, Gradle Wrapper, JUnit·Testcontainers, Vitest·Testing Library·Playwright. 구현 시작 시 잠금 파일과 Wrapper에 해상된 버전을 고정합니다.

**설계:** `docs/superpowers/specs/2026-09-27-choir-member-portal-design.md`

## 공통 제약

- `docs/`의 모든 Markdown 문서를 읽고 시작합니다. 모든 사용자 문구와 주석은 한국어로 작성합니다.
- 공개 가입만으로 운영진 권한을 얻을 수 없습니다. 이메일 확인과 운영진 승인은 별개의 단계입니다.
- 활동 단원과 OB를 구분합니다. OB는 OB 참여 행사에서만 출석할 수 있습니다.
- 출석 창의 유효 시간은 10분입니다. QR과 입력 코드는 같은 출석 창에 속하며 재발급 시 이전 값이 즉시 무효가 됩니다.
- 회원·행사당 유효 출석 기록은 최대 한 건입니다. 지각·공결 판정은 첫 범위에 넣지 않습니다.
- 관리자 작업 중 승인·반려·접근 해제·출석 정정은 수행자와 시각을 남깁니다.
- 공개 화면과 API는 회원 공지, 비공개 행사, 개인 출석 정보를 반환하지 않습니다. 첫 구현에 공개 행사 API는 없습니다.
- 비밀값은 환경 변수 또는 비밀 저장소에서 읽습니다. 테스트용 메일 송신기는 테스트 설정에서만 사용합니다.
- 배포 전 운영진이 승인 담당자, 보유 명단 대조 방식, 첫 운영진 계정, 메일 발송 도메인을 확인해야 합니다. 이 결정은 가입·승인 API의 안전한 구현과 별개로 운영 준비 항목입니다.

## 공통 계약과 파일 경계

| 위치 | 책임 |
| --- | --- |
| `api/src/main/java/kr/ac/jnu/choir/auth/` | 신청, 이메일 확인, 로그인, 재설정, 세션, 권한 확인 |
| `api/src/main/java/kr/ac/jnu/choir/member/` | 계정 상태, 단원 구분, 운영진 승인 |
| `api/src/main/java/kr/ac/jnu/choir/notice/` | 회원 공지 조회·관리 |
| `api/src/main/java/kr/ac/jnu/choir/event/` | 행사, 달력용 조회, 공개 여부 |
| `api/src/main/java/kr/ac/jnu/choir/attendance/` | 출석 창, 자가 출석, 정정, 상태 조회 |
| `api/src/main/java/kr/ac/jnu/choir/common/` | 공통 오류 응답, 관리자 행위 기록, 시간 주입 |
| `api/src/main/resources/db/migration/` | Flyway SQL; 테이블 생성은 각 기능 작업의 마이그레이션에 배치 |
| `web/src/app/` | 공개·인증·회원·운영진 경로 |
| `web/src/features/` | 기능별 API 클라이언트, 타입, 화면 컴포넌트 |
| `web/src/lib/api.ts` | 동일 출처 `/api/v1` 요청, CSRF 헤더, 오류 변환 |

공통 API 오류는 `{ "code": "문자열", "message": "한국어 문장" }`입니다. 날짜·시간은 API에서 UTC ISO 8601로 송수신하고 화면에서 `Asia/Seoul`로 표시합니다. 페이지 목록은 `items`, `page`, `size`, `total`을 반환합니다. 요청 유효성 오류는 400, 미인증은 401, 권한 없음은 403, 상태 충돌은 409를 사용합니다. 클라이언트는 오류 `code`를 사용해 안내 문구를 결정합니다.

세션 쿠키는 `HttpOnly`, `Secure`, `SameSite=Lax`로 설정합니다. 브라우저는 Next.js의 외부 rewrite로 같은 출처 `/api/v1`에 요청합니다. Spring Security의 CSRF 보호를 유지하고 `GET /api/v1/auth/csrf`에서 받은 토큰을 변경 요청의 `X-CSRF-TOKEN` 헤더에 넣습니다. 세션은 JDBC에 저장하고, 매 요청에서 DB의 계정 상태와 `auth_version`을 확인해 접근 해제를 즉시 반영합니다. 민감한 응답은 `Cache-Control: no-store`입니다.

### 작업 1: 실행 가능한 기반과 회원 데이터

**파일**

- 생성: `api/build.gradle.kts`, `api/settings.gradle.kts`, `api/gradlew`, `api/gradlew.bat`, `api/gradle/wrapper/*`, `api/src/main/java/kr/ac/jnu/choir/ChoirApplication.java`
- 생성: `api/src/main/resources/application.yml`, `api/src/main/resources/db/migration/V1__member_and_auth.sql`, `api/src/main/java/kr/ac/jnu/choir/member/Member.java`, `api/src/main/java/kr/ac/jnu/choir/member/MemberRepository.java`
- 생성: `api/src/main/java/kr/ac/jnu/choir/common/ApiError.java`, `api/src/main/java/kr/ac/jnu/choir/common/ApiExceptionHandler.java`, `api/src/main/java/kr/ac/jnu/choir/common/TimeConfig.java`
- 생성: `api/src/test/java/kr/ac/jnu/choir/DatabaseMigrationTest.java`, `compose.yaml`, `web/package.json`, `web/package-lock.json`, `web/next.config.ts`, `web/src/app/layout.tsx`, `web/src/app/page.tsx`, `web/src/lib/api.ts`, `web/vitest.config.ts`, `web/src/test/setup.ts`

**계약:** `Member`는 `id: Long`, `email: String`, `name: String`, `passwordHash: String`, `status: EMAIL_PENDING | APPROVAL_PENDING | APPROVED | REJECTED | REVOKED`, `memberType: ACTIVE | OB | null`, `admin: boolean`, `authVersion: long`을 제공합니다. `MemberRepository.findByEmailIgnoreCase(String)`를 이후 작업에서 사용합니다.

- [ ] 1. 빈 저장소에 Gradle Wrapper와 Spring Boot 4.1.1 프로젝트, Next.js 16.3.6 TypeScript 프로젝트를 생성합니다. Spring 의존성은 `webmvc`, `data-jpa`, `validation`, `security`, `session-jdbc`, `flyway`, `mail`, MySQL 드라이버와 MySQL용 Flyway 모듈, 테스트용 Testcontainers를 포함합니다. Next.js는 App Router와 ESLint를 사용하고 Vitest·Testing Library를 `npm test`로 실행되게 설정합니다. 개발용 `compose.yaml`은 MySQL 8.4만 열고 비밀번호는 `.env`로 받습니다.
- [ ] 2. 실패 테스트 `DatabaseMigrationTest`를 작성합니다. MySQL Testcontainers에서 Flyway 실행 후 다음 조회가 두 테이블과 회원 이메일의 고유 인덱스를 찾도록 검사합니다.

```sql
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('member', 'auth_token');
SELECT COUNT(*) FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member'
  AND INDEX_NAME = 'uq_member_email';
```

- [ ] 3. `cd api; .\gradlew.bat test --tests '*DatabaseMigrationTest'`를 실행해 마이그레이션이 없어 실패하는지 확인합니다.
- [ ] 4. `V1__member_and_auth.sql`에 `member`, `auth_token`, Spring Session JDBC 테이블과 인덱스를 생성합니다. `member.email`은 소문자 정규화 후 유일하게 저장하고, `auth_token`은 `member_id`, `purpose`, `token_hash`, `expires_at`, `used_at`을 가집니다. JPA의 자동 DDL은 `validate`로 설정합니다. 서버 시간은 `Clock` 빈으로 주입합니다. 공개 첫 화면은 확인된 합창단 운영 사실을 임의로 쓰지 않고 소개 문구·로그인·가입 경로만 둡니다.
- [ ] 5. 같은 테스트와 `cd web; npm run build; npm run lint`를 통과시킵니다. `web/next.config.ts`의 rewrite는 `/api/v1/:path*`를 서버 전용 `API_INTERNAL_URL`로 전달합니다. 이 값은 로컬 `.env.local`과 배포 환경에 각각 설정하고 누락되면 명시적으로 실패하게 합니다.
- [ ] 6. 새 파일만 선택해 `feat: 회원 포털 실행 기반과 회원 스키마 추가`로 커밋합니다.

### 작업 2: 가입 신청과 이메일 확인

**파일**

- 생성: `api/src/main/java/kr/ac/jnu/choir/auth/RegistrationService.java`, `api/src/main/java/kr/ac/jnu/choir/auth/AuthTokenService.java`, `api/src/main/java/kr/ac/jnu/choir/auth/AuthController.java`, `api/src/main/java/kr/ac/jnu/choir/auth/MailSender.java`, `api/src/main/java/kr/ac/jnu/choir/auth/SmtpMailSender.java`
- 생성: `api/src/test/java/kr/ac/jnu/choir/auth/RegistrationFlowTest.java`, `web/src/app/(auth)/join/page.tsx`, `web/src/app/(auth)/verify-email/page.tsx`, `web/src/features/auth/registration.ts`, `web/src/features/auth/RegistrationForm.tsx`, `web/src/features/auth/RegistrationForm.test.tsx`
- 수정: `api/src/main/java/kr/ac/jnu/choir/member/MemberRepository.java`, `web/src/lib/api.ts`

**계약:** `POST /api/v1/auth/applications` 입력 `{email,password,name}`, 성공 202. `POST /api/v1/auth/verify-email` 입력 `{token}`, 성공 204. `POST /api/v1/auth/resend-verification` 입력 `{email}`, 성공 202. 가입 상태는 이메일 확인 전 `EMAIL_PENDING`, 확인 뒤 `APPROVAL_PENDING`입니다.

- [ ] 1. `RegistrationFlowTest`에 신규 가입의 비밀번호 해시 저장, 24시간 이내 일회용 확인 링크, 만료·재사용 토큰 거절, 확인 후 승인 대기 전환, 중복 이메일 거절을 작성합니다. 예시는 아래와 같습니다.

```java
assertThat(member.getStatus()).isEqualTo(AccountStatus.EMAIL_PENDING);
assertThat(member.getPasswordHash()).doesNotContain("correct-horse-battery");
verifyEmail(token);
assertThat(memberRepository.findById(member.getId()).orElseThrow().getStatus())
    .isEqualTo(AccountStatus.APPROVAL_PENDING);
assertThatThrownBy(() -> verifyEmail(token)).hasMessageContaining("사용할 수 없는 확인 링크");
```

- [ ] 2. `cd api; .\gradlew.bat test --tests '*RegistrationFlowTest'`에서 서비스 부재로 실패하는지 확인합니다.
- [ ] 3. `RegistrationService.apply(String email, String password, String name)`가 이메일 소문자화·형식 확인·최소 비밀번호 길이 12·중복 확인 뒤 `PasswordEncoderFactories.createDelegatingPasswordEncoder()`로 해시하게 만듭니다. `AuthTokenService`는 `SecureRandom` 32바이트 토큰을 URL 안전 문자열로 만들고 SHA-256 해시만 저장합니다. 24시간 만료, 일회용 사용, 재요청 시 기존 미사용 링크 폐기를 구현합니다. 메일 재요청은 주소 존재 여부를 노출하지 않는 202 응답을 주고 동일 주소의 재요청을 10분에 한 번으로 제한합니다.
- [ ] 4. 메일 본문의 링크는 `https://<서비스도메인>/verify-email#token=<값>`으로 생성합니다. 프론트는 해시 값을 읽어 즉시 URL에서 제거한 뒤 POST로 확인합니다. `RegistrationForm.test.tsx`에서 필수 입력, 요청 중 중복 전송 방지, 승인 대기 안내를 검사하고 폼을 구현합니다.
- [ ] 5. `cd api; .\gradlew.bat test --tests '*RegistrationFlowTest'`, `cd web; npm test -- --run RegistrationForm`, `npm run build`, `npm run lint`를 실행합니다. 테스트 메일 송신기는 테스트 설정에만 주입합니다.
- [ ] 6. 해당 파일만 `feat: 가입 신청과 이메일 확인 추가`로 커밋합니다.

### 작업 3: 로그인, 세션, 비밀번호 재설정

**파일**

- 생성: `api/src/main/java/kr/ac/jnu/choir/auth/SecurityConfig.java`, `api/src/main/java/kr/ac/jnu/choir/auth/SessionMemberService.java`, `api/src/main/java/kr/ac/jnu/choir/auth/LoginAttemptLimiter.java`, `api/src/main/java/kr/ac/jnu/choir/auth/PasswordResetService.java`, `api/src/main/resources/db/migration/V2__auth_attempt.sql`
- 생성: `api/src/test/java/kr/ac/jnu/choir/auth/SessionSecurityTest.java`, `api/src/test/java/kr/ac/jnu/choir/auth/PasswordResetTest.java`, `web/src/app/(auth)/login/page.tsx`, `web/src/app/(auth)/reset-password/page.tsx`, `web/src/app/(auth)/application-status/page.tsx`, `web/src/features/auth/session.ts`, `web/src/features/auth/LoginForm.tsx`, `web/src/features/auth/LoginForm.test.tsx`
- 수정: `api/src/main/java/kr/ac/jnu/choir/auth/AuthController.java`, `web/src/lib/api.ts`

**계약:** `GET /api/v1/auth/csrf` → `{token}`, `POST /login` → 204, `POST /logout` → 204, `GET /me` → `{id,name,status,memberType,admin}`. `POST /password-reset/request` → 202, `POST /password-reset/confirm` 입력 `{token,newPassword}` → 204. 승인 전 계정은 로그인 후에도 `/me`로 상태만 볼 수 있고 회원 API 접근은 403입니다.

- [ ] 1. `SessionSecurityTest`에 미인증 401, 승인 대기 회원의 회원 API 403, 승인 회원의 200, CSRF 없는 변경 요청 403, 로그아웃 후 401, `auth_version` 증가 후 기존 세션 401을 작성합니다. `PasswordResetTest`는 30분 만료·일회용·재설정 후 기존 세션 무효화를 검사합니다.

```java
assertThat(get("/api/v1/auth/me", oldSession).status()).isEqualTo(401);
assertThat(post("/api/v1/auth/logout", sessionWithoutCsrf).status()).isEqualTo(403);
assertThat(post("/api/v1/auth/password-reset/confirm", usedToken).status()).isEqualTo(409);
```

- [ ] 2. `cd api; .\gradlew.bat test --tests '*SessionSecurityTest' --tests '*PasswordResetTest'`에서 실패를 확인합니다.
- [ ] 3. `SecurityFilterChain`에 공개 인증 경로와 그 외 회원·운영진 경로를 명시하고 CSRF를 유지합니다. 로그인 성공 시 세션 ID를 교체하고 `memberId`, `authVersion`만 세션에 둡니다. `SessionMemberService.requireApproved()`와 `requireAdmin()`은 매 요청의 DB 상태·버전·운영진 여부를 검사합니다. 세션 저장소는 JDBC이며 로그인·비밀번호 재설정·접근 해제에 대응합니다.
- [ ] 4. `auth_attempt` 테이블을 이용해 정규화 이메일과 IP 기준 각각 15분에 실패 5회 제한을 구현하고, 성공 시 이메일 실패 횟수를 초기화합니다. 비밀번호 재설정 메일은 계정 존재 여부와 관계없이 202를 반환하고 주소·IP별 15분에 3회로 제한합니다. 신규 비밀번호는 최소 12자이며 저장 시 해시합니다.
- [ ] 5. `web/src/lib/api.ts`는 변경 요청 전에 CSRF 토큰을 받아 `X-CSRF-TOKEN`을 보냅니다. `LoginForm.test.tsx`에서 잘못된 자격 증명, 승인 대기 안내, 로그인 후 이동을 검사합니다. 승인 대기·이메일 미확인 상태와 재발송 경로는 `application-status` 화면에 표시합니다. 401은 로그인으로, 403은 상태 안내로 처리합니다.
- [ ] 6. 두 API 테스트와 `cd web; npm test -- --run LoginForm; npm run build; npm run lint`를 통과시키고 `feat: 세션 로그인과 비밀번호 재설정 추가`로 커밋합니다.

### 작업 4: 운영진 승인과 접근 해제

**파일**

- 생성: `api/src/main/java/kr/ac/jnu/choir/member/AdminMemberController.java`, `api/src/main/java/kr/ac/jnu/choir/member/MemberApprovalService.java`, `api/src/main/java/kr/ac/jnu/choir/common/AdminActionLog.java`, `api/src/main/java/kr/ac/jnu/choir/common/AdminActionLogRepository.java`, `api/src/main/java/kr/ac/jnu/choir/member/AdminBootstrapCommand.java`, `api/src/main/resources/db/migration/V3__admin_action_log.sql`
- 생성: `api/src/test/java/kr/ac/jnu/choir/member/MemberApprovalTest.java`, `web/src/app/(admin)/admin/applications/page.tsx`, `web/src/features/member/adminMembers.ts`, `web/src/features/member/ApplicationQueue.tsx`, `web/src/features/member/ApplicationQueue.test.tsx`

**계약:** `GET /api/v1/admin/applications?status=APPROVAL_PENDING&page=0&size=20`; `POST /api/v1/admin/applications/{id}/approve` 입력 `{memberType:"ACTIVE"|"OB"}`; `POST /api/v1/admin/applications/{id}/reject` 입력 `{reason}`; `POST /api/v1/admin/members/{id}/revoke` 입력 `{reason}`. 변경은 204, 잘못된 상태 전이는 409입니다.

- [ ] 1. `MemberApprovalTest`에 일반 회원의 403, 확인 전 신청의 승인 409, 승인 후 역할 부여, OB 승인, 반려·접근 해제 감사 기록, 해제된 기존 세션의 401을 작성합니다.

```java
assertThat(approve(pendingMemberId, "OB", adminSession).status()).isEqualTo(204);
assertThat(memberRepository.findById(pendingMemberId).orElseThrow().getMemberType())
    .isEqualTo(MemberType.OB);
assertThat(adminActionLogRepository.countByTargetMemberId(pendingMemberId)).isEqualTo(1);
```

- [ ] 2. `cd api; .\gradlew.bat test --tests '*MemberApprovalTest'` 실패를 확인합니다.
- [ ] 3. 서비스 메서드를 트랜잭션으로 구현합니다. 승인 시 `APPROVAL_PENDING`을 `APPROVED`로, 반려 시 `REJECTED`로, 접근 해제 시 `REVOKED`로 변경하고 `auth_version`을 증가시킵니다. `admin_action_log`에 actor, target, action, 이전·새 상태, 이유, 시각을 저장합니다. 이유는 회원 화면에 자동 공개하지 않습니다.
- [ ] 4. `AdminBootstrapCommand`는 배포자의 DB 접근 권한이 필요한 비 HTTP 명령으로만 실행하며, **이메일 확인된 기존 계정 한 명**을 지정한 단원 구분으로 승인하고 운영진 권한을 부여합니다. 기존 운영진이 있으면 실행을 거절합니다. 공개 API·환경 변수만으로 운영진을 자동 생성하지 않습니다.
- [ ] 5. `ApplicationQueue.test.tsx`에서 목록 상태, ACTIVE/OB 선택, 반려 이유 입력, 이미 처리된 신청의 충돌 메시지를 확인하고 운영진 화면을 구현합니다.
- [ ] 6. API·웹 테스트와 빌드·린트를 통과시키고 `feat: 회원 승인과 접근 해제 추가`로 커밋합니다.

### 작업 5: 회원 공지

**파일**

- 생성: `api/src/main/resources/db/migration/V4__notice.sql`, `api/src/main/java/kr/ac/jnu/choir/notice/Notice.java`, `api/src/main/java/kr/ac/jnu/choir/notice/NoticeRepository.java`, `api/src/main/java/kr/ac/jnu/choir/notice/NoticeService.java`, `api/src/main/java/kr/ac/jnu/choir/notice/NoticeController.java`, `api/src/test/java/kr/ac/jnu/choir/notice/NoticeAccessTest.java`
- 생성: `web/src/app/(member)/notices/page.tsx`, `web/src/app/(admin)/admin/notices/page.tsx`, `web/src/features/notice/notices.ts`, `web/src/features/notice/NoticeList.tsx`, `web/src/features/notice/NoticeEditor.tsx`, `web/src/features/notice/NoticeList.test.tsx`

**계약:** `GET /api/v1/notices?page=0&size=20`은 최신 게시순 목록, `GET /api/v1/notices/{id}`는 본문입니다. `POST /api/v1/admin/notices`와 `PUT /api/v1/admin/notices/{id}`는 `{title,body,published}`를 받습니다. `published=false`는 운영진만 열람합니다.

- [ ] 1. `NoticeAccessTest`에 승인 회원의 게시 공지 열람, 공개·미승인 계정의 거절, 일반 회원 변경 403, 비게시 공지의 회원 조회 404, 운영진 작성·수정의 반영을 작성합니다.

```java
assertThat(get("/api/v1/notices", anonymous).status()).isEqualTo(401);
assertThat(post("/api/v1/admin/notices", memberSession, noticeJson).status()).isEqualTo(403);
assertThat(get("/api/v1/notices/" + draftId, approvedSession).status()).isEqualTo(404);
```

- [ ] 2. `cd api; .\gradlew.bat test --tests '*NoticeAccessTest'` 실패를 확인합니다.
- [ ] 3. `notice` 테이블에 제목, 본문, 작성자, 생성·수정·게시 시각을 추가합니다. 본문은 일반 텍스트로 저장·표시해 스크립트 삽입 경로를 만들지 않습니다. 컨트롤러는 회원 조회와 운영진 변경 경로를 분리합니다.
- [ ] 4. `NoticeList.test.tsx`에서 최신순 목록·빈 상태·다음 페이지를 확인하고 회원 목록과 운영진 편집기를 구현합니다. 회원 첫 화면의 최근 공지 요약은 작업 6의 대시보드에 연결합니다.
- [ ] 5. API·웹 테스트와 빌드·린트를 통과시키고 `feat: 회원 공지 조회와 운영진 편집 추가`로 커밋합니다.

### 작업 6: 행사와 일정 중심 회원 첫 화면

**파일**

- 생성: `api/src/main/resources/db/migration/V5__event.sql`, `api/src/main/java/kr/ac/jnu/choir/event/Event.java`, `api/src/main/java/kr/ac/jnu/choir/event/EventRepository.java`, `api/src/main/java/kr/ac/jnu/choir/event/EventService.java`, `api/src/main/java/kr/ac/jnu/choir/event/EventController.java`, `api/src/test/java/kr/ac/jnu/choir/event/EventVisibilityTest.java`
- 생성: `web/src/app/(member)/dashboard/page.tsx`, `web/src/app/(member)/events/[id]/page.tsx`, `web/src/app/(admin)/admin/events/page.tsx`, `web/src/features/event/events.ts`, `web/src/features/event/EventCalendar.tsx`, `web/src/features/event/EventDetail.tsx`, `web/src/features/event/EventEditor.tsx`, `web/src/features/event/EventCalendar.test.tsx`

**계약:** `GET /api/v1/events?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z`는 기간 내 회원 행사 목록, `GET /api/v1/events/{id}`는 상세입니다. `POST /api/v1/admin/events`, `PUT /api/v1/admin/events/{id}`는 `{title,description,startAt,endAt,obEligible,publicVisible}`를 받습니다. `publicVisible`은 이후 공개 아카이브를 위한 저장 필드이며 이번 구현에 공개 행사 API는 없습니다.

- [ ] 1. `EventVisibilityTest`에 날짜 범위, `startAt < endAt` 검증, 비로그인 행사 API 거절, 일반 회원의 운영진 변경 403을 작성합니다.

```java
assertThat(get("/api/v1/events", anonymous).status()).isEqualTo(401);
assertThat(get("/api/v1/public/events", anonymous).status()).isEqualTo(404);
assertThat(createEvent(startAtAfterEndAt).status()).isEqualTo(400);
```

- [ ] 2. `cd api; .\gradlew.bat test --tests '*EventVisibilityTest'` 실패를 확인합니다.
- [ ] 3. `event` 테이블에 일정, 내용, `ob_eligible`, `public_visible`를 추가합니다. 회원 API는 승인된 모든 단원이 회원 행사를 볼 수 있게 하며, OB의 출석 가능 여부는 별도 플래그로 표현합니다. 공개 경로에서는 행사 응답을 제공하지 않습니다.
- [ ] 4. `EventCalendar.test.tsx`에서 날짜 선택, 선택 행사 상세, OB 출석 대상 표시, 모바일 세로 순서를 확인합니다. 대시보드는 달력 → 선택 행사 → 최근 공지 → 본인 출석 요약 순서로 구성하고 운영진 행사 편집 화면을 추가합니다. 실제 출석 버튼·상태는 작업 7에서 연결합니다.
- [ ] 5. API·웹 테스트와 빌드·린트를 통과시키고 `feat: 행사 관리와 일정 중심 대시보드 추가`로 커밋합니다.

### 작업 7: 현장 출석, 상태 조회, 운영진 정정

**파일**

- 생성: `api/src/main/resources/db/migration/V6__attendance.sql`, `api/src/main/java/kr/ac/jnu/choir/attendance/Attendance.java`, `api/src/main/java/kr/ac/jnu/choir/attendance/CheckInSession.java`, `api/src/main/java/kr/ac/jnu/choir/attendance/AttendanceRepository.java`, `api/src/main/java/kr/ac/jnu/choir/attendance/CheckInSessionRepository.java`, `api/src/main/java/kr/ac/jnu/choir/attendance/CheckInService.java`, `api/src/main/java/kr/ac/jnu/choir/attendance/AttendanceController.java`
- 생성: `api/src/test/java/kr/ac/jnu/choir/attendance/CheckInFlowTest.java`, `api/src/test/java/kr/ac/jnu/choir/attendance/ConcurrentCheckInTest.java`, `web/src/app/(member)/attendance/page.tsx`, `web/src/app/(member)/events/[id]/check-in/page.tsx`, `web/src/app/(admin)/admin/events/[id]/attendance/page.tsx`, `web/src/features/attendance/attendance.ts`, `web/src/features/attendance/CheckInPanel.tsx`, `web/src/features/attendance/AdminAttendancePanel.tsx`, `web/src/features/attendance/CheckInPanel.test.tsx`
- 수정: `web/src/features/event/EventDetail.tsx`, `web/src/app/(member)/dashboard/page.tsx`, `api/src/main/java/kr/ac/jnu/choir/common/AdminActionLog.java`

**계약:** 운영진 `POST /api/v1/admin/events/{id}/check-in-session`은 10분짜리 출석 창을 열고 `{sessionId,expiresAt,qrUrl,code}`를 한 번 반환합니다. `POST /.../rotate`는 같은 창의 새 QR·코드를 발급합니다. `POST /.../close`는 204입니다. 회원 `POST /api/v1/events/{id}/check-ins` 입력 `{credential}`은 성공 204, 대상 아님 403, 만료·닫힘 409, 중복 409입니다. `GET /api/v1/events/{id}/attendance/me`는 `CHECKED_IN | MISSED | NOT_OPEN | NOT_ELIGIBLE`을 반환합니다. `GET /api/v1/attendance/me`는 본인 기록 목록입니다. 운영진 `PUT /api/v1/admin/events/{id}/attendance/{memberId}` 입력 `{status:"CHECKED_IN"|"MISSED",reason}`은 정정합니다.

- [ ] 1. `CheckInFlowTest`에 활동 단원 성공, OB 대상 행사 성공·비대상 행사 403, 10분 만료, 닫힘, 재발급 전 코드 거절, 중복 요청, 정정 감사 기록, 창 종료 후 미출석 표시를 작성합니다. `ConcurrentCheckInTest`는 같은 회원·행사에 동시 요청 2개를 보내 한 건만 저장되는지 검사합니다.

```java
assertThat(checkIn(obMember, activeOnlyEvent, code).status()).isEqualTo(403);
assertThat(checkIn(activeMember, event, expiredCode).status()).isEqualTo(409);
assertThat(attendanceRepository.countByEventIdAndMemberId(eventId, memberId)).isEqualTo(1);
```

- [ ] 2. `cd api; .\gradlew.bat test --tests '*CheckInFlowTest' --tests '*ConcurrentCheckInTest'` 실패를 확인합니다.
- [ ] 3. `attendance`에 `(event_id,member_id)` 고유 제약을 걸고 상태·확인 시각을 저장합니다. `check_in_session`은 행사당 열린 창 하나만 허용하고 만료 시각, 닫힘 시각, QR 토큰 해시, 입력 코드 해시를 저장합니다. QR은 32바이트 난수, 입력 코드는 보안 난수로 생성한 8자리 영숫자이며 서버에는 해시만 저장합니다. 인증된 회원에 대해 행사·대상·창 상태를 트랜잭션에서 검증하고 DB 고유 제약 충돌도 중복 응답으로 변환합니다. 출석 시도는 계정당 분당 10회, IP당 분당 100회로 제한합니다.
- [ ] 4. QR URL은 `/events/{id}/check-in#token=<값>`으로 만들고, 브라우저가 해시를 읽자마자 주소에서 제거한 뒤 본문으로 제출합니다. 코드 재발급 시 기존 QR·코드 해시를 교체합니다. 출석 창이 닫힌 후 대상 회원에게 기록이 없으면 `MISSED`를 계산해 반환하고, 정정 시에는 이전·새 상태와 이유를 `admin_action_log`에 남깁니다.
- [ ] 5. `CheckInPanel.test.tsx`에서 만료·중복·대상 아님·승인 대기 안내, 본인 상태 갱신을 검사합니다. 행사 상세·대시보드·내 출석 목록에 상태를 연결하고 운영진 QR·코드 표시와 정정 화면을 구현합니다. QR 생성은 브라우저에서 로컬 렌더링하고 외부 QR 서비스로 토큰을 보내지 않습니다.
- [ ] 6. API·웹 테스트와 빌드·린트를 통과시키고 `feat: 현장 출석과 정정 기능 추가`로 커밋합니다.

### 작업 8: 실제 사용자 흐름과 공개 경계 검증

**파일**

- 생성: `web/e2e/member-journey.spec.ts`, `web/e2e/public-boundary.spec.ts`, `web/playwright.config.ts`, `api/src/test/java/kr/ac/jnu/choir/security/AuthorizationMatrixTest.java`, `docs/operations.md`, `.env.example`
- 수정: `web/package.json`, `api/src/main/resources/application.yml`, `compose.yaml`

**계약:** 이 작업은 기존 API를 변경하지 않고 회원·운영진·방문자의 핵심 흐름을 통합 검증합니다. 테스트 계정과 메일은 격리된 테스트 환경에서만 생성합니다.

- [ ] 1. `AuthorizationMatrixTest`를 먼저 작성합니다. 비로그인, 승인 대기, 접근 해제, 활동 단원, OB, 운영진의 각 회원·운영진 API 허용/거부를 표 기반으로 검사합니다. 비로그인 사용자에게 공개 행사·공지·출석 API가 없는지도 확인합니다.

```java
assertThat(get("/api/v1/admin/applications", approvedMemberSession).status()).isEqualTo(403);
assertThat(get("/api/v1/notices", revokedMemberSession).status()).isEqualTo(401);
assertThat(get("/api/v1/public/events", anonymous).status()).isEqualTo(404);
```

- [ ] 2. `member-journey.spec.ts`에 가입 → 이메일 확인 → 운영진 승인 → 로그인 → 달력 행사 선택 → QR/코드 출석 → 본인 기록 확인 → 운영진 정정 → 회원 화면 변경 확인을 작성합니다. `public-boundary.spec.ts`에는 공개 화면에서 비공개 행사·공지·개인 출석 자료의 부재를 작성합니다. 실패를 확인한 뒤 화면·API 연결 결함만 수정합니다.
- [ ] 3. `docs/operations.md`에 환경 변수 목록, MySQL 마이그레이션, 메일 설정, 첫 운영진 지정 절차, 세션·비밀번호 정책, 백업/복구, 운영진 승인 전 명단 대조, 출석 코드 유출 시 재발급 절차를 문장으로 작성합니다. `.env.example`에는 값 대신 변수명과 설명만 둡니다.
- [ ] 4. `cd api; .\gradlew.bat test`, `cd web; npm test -- --run; npm run lint; npm run build; npx playwright test`를 실행합니다. 모바일 폭 390px에서 가로 넘침과 달력→행사→공지→출석 순서, 브라우저 콘솔 오류를 확인합니다. 실패가 있으면 해당 원인만 고치고 같은 검증을 다시 실행합니다.
- [ ] 5. 비밀값·테스트 계정·디버그 로그가 추적 파일에 없는지 확인하고, 통합 검증 파일과 필요한 수정만 `test: 회원 포털 핵심 흐름과 접근 경계 검증`으로 커밋합니다.

## 실행 전 확인과 완료 조건

구현 시작 전에 운영진으로부터 실제 승인 담당자와 명단 대조 절차, 메일 발송 계정·도메인, 최초 운영진으로 지정할 검증된 계정을 받습니다. 이 정보가 없어도 로컬 테스트까지 구현할 수 있지만, 운영 환경의 회원 승인과 메일 발송은 활성화할 수 없습니다. 공개 온보딩의 시각 디자인과 공개 행사 아카이브 API·UI는 별도 설계 후 계획합니다.

완료 조건은 설계 문서의 검증 기준 전체 충족, 전체 API·웹·브라우저 테스트 통과, 모바일 화면 점검, 운영 문서 작성입니다. 작업 1~8은 각각 검토 가능한 커밋으로 남기며 요청받기 전에는 배포하지 않습니다.

## 기술 근거

- [Next.js 설치 및 실행 요구 사항](https://nextjs.org/docs/app/getting-started/installation), [외부 URL rewrite](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [Spring Boot 4.1.1 요구 사항](https://docs.spring.io/spring-boot/system-requirements.html), [웹 MVC 스타터](https://docs.spring.io/spring-boot/reference/web/index.html), [Spring Session JDBC](https://docs.spring.io/spring-boot/reference/web/spring-session.html)
- [Spring Security 암호 저장](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html), [CSRF 보호](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [OWASP 세션 관리](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [이메일 주소 확인](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)
