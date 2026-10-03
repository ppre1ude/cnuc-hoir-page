# 단원 직책·권한 체계 ①단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원에게 파트·기수·직책을 두고, 서버가 직책에서 권한 목록을 계산해 API와 화면이 그 권한으로 기능을 열고 닫게 한다.

**Architecture:** `member_role` 테이블에 직책을 여러 개 저장하고, 순수 자바 클래스 `Permissions`가 사이트 관리자 여부·직책·단원 구분에서 `Permission` 집합을 만든다. `SessionMemberService.require(request, permission)`이 기존 `requireAdmin`을 대체하고, `/auth/me`가 직책과 권한 목록을 내려 준다. 화면은 `can(session, permission)`으로 메뉴·버튼을 가린다.

**Tech Stack:** Spring Boot 4.1 (Java 21, JPA, Flyway, Testcontainers PostgreSQL 17), Next.js 16 (React 19, CSS Modules, Vitest, Testing Library)

**Spec:** `docs/superpowers/specs/2026-10-03-member-roles-design.md`

## Global Constraints

- 실제 사람 이름, 학과, 학번은 코드·테스트·문서에 넣지 않는다. 테스트 데이터는 "단원", "수석" 같은 일반 이름을 쓴다.
- 직책·부서·계·파트 목록은 코드에 고정한다: 직책 단장·부단장·총무·부장·부원·수석, 부서 기획·홍보부·관리부, 계 기획계·홍보계·악보계·비품계, 파트 소프라노·알토·테너·베이스·피아노.
- OB와 승인되지 않은 계정은 직책을 가질 수 없다. 접근 해제 시 직책을 모두 지운다.
- 모든 권한은 서버에서 다시 검사한다. 화면은 숨기기만 한다.
- 기존 `admin` 열은 사이트 관리자 뜻으로 유지한다. 사이트 관리자는 직책이 없어도 모든 권한을 가진다.
- 새 CSS는 `web/src/styles/tokens.css`의 토큰만 쓴다. 새 라이브러리를 추가하지 않는다.
- 커밋 메시지는 한국어로 쓰고 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`로 끝낸다. 푸시는 사용자가 요청할 때만 한다.
- API 테스트는 Docker가 필요하다(Testcontainers). 명령은 `api` 폴더에서 `./gradlew test --tests <클래스>`이고, Windows에서는 `.\gradlew.bat`을 쓴다.
- 웹 테스트는 `web` 폴더에서 `npx vitest run <경로>`, 린트는 `npx eslint`, 타입 검사는 `npx tsc --noEmit`이다.

## 파일 구조

API (`api/src/main/java/kr/ac/jnu/choir/`):
- `member/Part.java`, `member/Role.java`, `member/Department.java`, `member/Unit.java` — 고정 목록 enum (새로 만듦)
- `member/MemberRole.java`, `member/MemberRoleRepository.java` — 직책 엔티티와 저장소 (새로 만듦)
- `member/Member.java` — `part`, `cohort` 열과 `updateProfile`, `setSiteAdmin` 추가
- `member/MemberRoleService.java`, `member/AdminMemberRoleController.java` — 직책·프로필·사이트 관리자 변경 API (새로 만듦)
- `auth/Permission.java` — 권한 enum (새로 만듦)
- `auth/Permissions.java` — 직책 → 권한 계산, 순수 자바 (새로 만듦)
- `auth/PermissionService.java` — 회원의 직책을 읽어 권한을 계산하는 Spring 서비스 (새로 만듦)
- `auth/SessionMemberService.java` — `require(request, Permission)` 추가, `requireAdmin` 삭제
- `auth/SecurityConfig.java` — `/api/v1/admin/**`를 `hasRole("MEMBER")`로 바꿈
- `auth/AuthController.java` — `MeResponse`에 파트·기수·직책·권한 추가
- 컨트롤러·서비스의 `requireAdmin` 호출을 권한별 `require`로 교체
- `resources/db/postgresql/V5__member_roles.sql` — 마이그레이션 (새로 만듦)

API 테스트 (`api/src/test/java/kr/ac/jnu/choir/`):
- `auth/PermissionsTest.java` — 순수 단위 테스트 (새로 만듦)
- `member/MemberRoleTest.java` — 직책 API 통합 테스트 (새로 만듦)
- `security/AuthorizationMatrixTest.java` — 직책별 행 추가

웹 (`web/src/`):
- `features/auth/session.ts` — `MemberSession`에 `part`, `cohort`, `roles`, `permissions`와 `can()` 추가
- `features/member/roles.ts` — 직책·부서·계·파트 한글 이름과 목록 (새로 만듦)
- `features/member/adminMembers.ts` — 직책·프로필·사이트 관리자 API 함수와 `MemberItem` 확장
- `features/member/MemberNavigation.tsx`, `features/member/AdminNavigation.tsx` — 권한으로 메뉴 가림
- `features/member/MemberRoles.tsx`, `features/member/MemberRoles.test.tsx` — 회원 행의 파트·기수·직책 편집 (새로 만듦)
- `features/member/MemberAccountManager.tsx` — 행에 `MemberRoles` 삽입, 초대·접근 해제·등록 명단을 권한으로 가림
- `features/member/MemberRegistration.tsx` — "운영진 권한도 부여" → "사이트 관리자 권한도 부여", 사이트 관리자에게만 표시
- `features/event/EventEditor.tsx`, `features/notice/NoticeEditor.tsx`, `features/attendance/AdminAttendancePanel.tsx`, `features/member/ApplicationQueue.tsx`, `features/event/EventPage.tsx` — `session.admin` 검사를 `can()`으로 교체

문서: `docs/operations.md`에 직책 부여 절차 한 단락 추가.

---

### Task 1: 권한 enum과 계산기 (순수 자바)

**Files:**
- Create: `api/src/main/java/kr/ac/jnu/choir/member/Part.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/member/Role.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/member/Department.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/member/Unit.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/auth/Permission.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/auth/Permissions.java`
- Test: `api/src/test/java/kr/ac/jnu/choir/auth/PermissionsTest.java`

**Interfaces:**
- Produces: `enum Part { SOPRANO, ALTO, TENOR, BASS, PIANO }`, `enum Role { PRESIDENT, VICE_PRESIDENT, TREASURER, DEPARTMENT_HEAD, DEPARTMENT_MEMBER, SECTION_LEAD }`, `enum Department { PLANNING_PR, MANAGEMENT }`, `enum Unit { PLANNING, PR, SCORES, SUPPLIES }`, `enum Permission { ... }`, `Permissions.of(boolean siteAdmin, MemberType memberType, Collection<Role> roles): Set<Permission>`, `Permissions.leadParts(Collection<RoleAssignment>)`는 ②단계에서 추가하므로 여기서는 만들지 않는다.

- [ ] **Step 1: enum 네 개와 Permission을 만든다**

`api/src/main/java/kr/ac/jnu/choir/member/Part.java`:
```java
package kr.ac.jnu.choir.member;

public enum Part {
    SOPRANO, ALTO, TENOR, BASS, PIANO
}
```

`api/src/main/java/kr/ac/jnu/choir/member/Role.java`:
```java
package kr.ac.jnu.choir.member;

// 단장단(단장·부단장·총무), 부서(부장·부원), 수석진(수석)입니다. 한 사람이 여러 개를 가질 수 있습니다.
public enum Role {
    PRESIDENT, VICE_PRESIDENT, TREASURER, DEPARTMENT_HEAD, DEPARTMENT_MEMBER, SECTION_LEAD
}
```

`api/src/main/java/kr/ac/jnu/choir/member/Department.java`:
```java
package kr.ac.jnu.choir.member;

public enum Department {
    PLANNING_PR, MANAGEMENT
}
```

`api/src/main/java/kr/ac/jnu/choir/member/Unit.java`:
```java
package kr.ac.jnu.choir.member;

// 부원이 속한 계입니다. 기획계·홍보계는 기획·홍보부, 악보계·비품계는 관리부입니다.
public enum Unit {
    PLANNING(Department.PLANNING_PR), PR(Department.PLANNING_PR),
    SCORES(Department.MANAGEMENT), SUPPLIES(Department.MANAGEMENT);

    private final Department department;

    Unit(Department department) {
        this.department = department;
    }

    public Department department() {
        return department;
    }
}
```

`api/src/main/java/kr/ac/jnu/choir/auth/Permission.java`:
```java
package kr.ac.jnu.choir.auth;

// 설계 문서의 권한 표 한 줄이 한 항목입니다. 서버는 이 값으로 요청을 검사하고, 화면은 이 값으로 메뉴를 가립니다.
public enum Permission {
    MANAGE_SITE_ADMINS,          // 사이트 관리자·단장·부단장 지정, 사이트 관리자 등록 명단
    MANAGE_ROLES,                // 그 밖의 직책 부여·해제, 파트·기수 수정
    REVOKE_ACCESS,               // 접근 해제
    MANAGE_ALLOWLIST,            // 자동 승인 명단
    APPROVE_APPLICATIONS,        // 가입 승인·반려, 1회용 링크 발급
    MANAGE_FULL_REHEARSALS,      // 전체연습 개최·수정
    MANAGE_PART_REHEARSALS,      // 모든 파트의 파트연습 개최·수정과 집계
    MANAGE_EVENTS,               // 행사·공지 등록·수정, 출석 창과 정정
    WRITE_MINUTES,               // 회의록 쓰기·고치기
    DELETE_MINUTES,              // 회의록 삭제
    VIEW_MEMBERS,                // 회원 목록 보기
    VIEW_MINUTES                 // 회의록 보기
}
```

- [ ] **Step 2: 실패하는 단위 테스트를 쓴다**

`api/src/test/java/kr/ac/jnu/choir/auth/PermissionsTest.java`:
```java
package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import java.util.List;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Role;
import org.junit.jupiter.api.Test;

class PermissionsTest {
    @Test void siteAdminHasEveryPermission() {
        assertThat(Permissions.of(true, MemberType.ACTIVE, List.of())).isEqualTo(EnumSet.allOf(Permission.class));
    }

    @Test void ordinaryActiveMemberOnlyViewsMinutes() {
        assertThat(Permissions.of(false, MemberType.ACTIVE, List.of())).containsExactly(Permission.VIEW_MINUTES);
    }

    @Test void obAndUnknownTypeHaveNothing() {
        assertThat(Permissions.of(false, MemberType.OB, List.of())).isEmpty();
        assertThat(Permissions.of(false, null, List.of())).isEmpty();
    }

    @Test void presidentManagesRolesButNotSiteAdmins() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.PRESIDENT));
        assertThat(permissions).contains(Permission.MANAGE_ROLES, Permission.REVOKE_ACCESS, Permission.MANAGE_ALLOWLIST,
                Permission.APPROVE_APPLICATIONS, Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_PART_REHEARSALS,
                Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES, Permission.VIEW_MEMBERS, Permission.VIEW_MINUTES);
        assertThat(permissions).doesNotContain(Permission.MANAGE_SITE_ADMINS, Permission.DELETE_MINUTES);
    }

    @Test void vicePresidentApprovesAndRunsRehearsalsButCannotAssignRoles() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.VICE_PRESIDENT));
        assertThat(permissions).contains(Permission.APPROVE_APPLICATIONS, Permission.MANAGE_FULL_REHEARSALS,
                Permission.MANAGE_PART_REHEARSALS, Permission.MANAGE_EVENTS);
        assertThat(permissions).doesNotContain(Permission.MANAGE_ROLES, Permission.REVOKE_ACCESS, Permission.MANAGE_ALLOWLIST);
    }

    @Test void staffRolesShareTheSameSet() {
        var expected = EnumSet.of(Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES, Permission.VIEW_MEMBERS, Permission.VIEW_MINUTES);
        for (Role role : List.of(Role.TREASURER, Role.DEPARTMENT_HEAD, Role.DEPARTMENT_MEMBER, Role.SECTION_LEAD)) {
            assertThat(Permissions.of(false, MemberType.ACTIVE, List.of(role))).as(role.name()).isEqualTo(expected);
        }
    }

    @Test void combinedRolesAreUnioned() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.VICE_PRESIDENT, Role.SECTION_LEAD));
        assertThat(permissions).contains(Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_EVENTS);
    }
}
```

- [ ] **Step 3: 테스트가 컴파일 오류로 실패하는지 확인한다**

Run: `cd api && ./gradlew test --tests kr.ac.jnu.choir.auth.PermissionsTest`
Expected: FAIL — `Permissions` 클래스를 찾을 수 없음

- [ ] **Step 4: Permissions를 구현한다**

`api/src/main/java/kr/ac/jnu/choir/auth/Permissions.java`:
```java
package kr.ac.jnu.choir.auth;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Role;

// 설계 문서의 권한 표를 그대로 옮긴 계산기입니다. 겸임이면 직책 권한의 합입니다.
public final class Permissions {
    private static final Set<Permission> STAFF = EnumSet.of(Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES,
            Permission.VIEW_MEMBERS);
    private static final Set<Permission> VICE_PRESIDENT = EnumSet.of(Permission.APPROVE_APPLICATIONS,
            Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_PART_REHEARSALS);
    private static final Set<Permission> PRESIDENT = EnumSet.of(Permission.MANAGE_ROLES, Permission.REVOKE_ACCESS,
            Permission.MANAGE_ALLOWLIST);

    private Permissions() {
    }

    public static Set<Permission> of(boolean siteAdmin, MemberType memberType, Collection<Role> roles) {
        if (siteAdmin) return EnumSet.allOf(Permission.class);
        Set<Permission> result = EnumSet.noneOf(Permission.class);
        if (memberType != MemberType.ACTIVE) return result;
        result.add(Permission.VIEW_MINUTES);
        for (Role role : roles) {
            result.addAll(STAFF);
            if (role == Role.PRESIDENT || role == Role.VICE_PRESIDENT) result.addAll(VICE_PRESIDENT);
            if (role == Role.PRESIDENT) result.addAll(PRESIDENT);
        }
        return result;
    }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd api && ./gradlew test --tests kr.ac.jnu.choir.auth.PermissionsTest`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add api/src/main/java/kr/ac/jnu/choir/member/Part.java api/src/main/java/kr/ac/jnu/choir/member/Role.java api/src/main/java/kr/ac/jnu/choir/member/Department.java api/src/main/java/kr/ac/jnu/choir/member/Unit.java api/src/main/java/kr/ac/jnu/choir/auth/Permission.java api/src/main/java/kr/ac/jnu/choir/auth/Permissions.java api/src/test/java/kr/ac/jnu/choir/auth/PermissionsTest.java
git commit -m "feat: 직책에서 권한 집합을 계산하는 규칙 추가

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 직책 저장과 로그인 응답

**Files:**
- Create: `api/src/main/resources/db/postgresql/V5__member_roles.sql`
- Create: `api/src/main/java/kr/ac/jnu/choir/member/MemberRole.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/member/MemberRoleRepository.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/auth/PermissionService.java`
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/Member.java` (필드 `admin` 아래, `isAdmin()` 근처)
- Modify: `api/src/main/java/kr/ac/jnu/choir/auth/AuthController.java:88-100`
- Test: `api/src/test/java/kr/ac/jnu/choir/member/MemberRoleTest.java`

**Interfaces:**
- Produces: `MemberRole(Member member, Role role, Department department, Unit unit, Part part, Member assignedBy, Instant assignedAt)`, `MemberRoleRepository.findByMemberIdOrderByAssignedAtAsc(Long)`, `MemberRoleRepository.deleteByMemberId(Long)`, `PermissionService.rolesOf(Member): List<MemberRole>`, `PermissionService.of(Member): Set<Permission>`, `Member.getPart()`, `Member.getCohort()`, `Member.updateProfile(Part, Integer, Clock)`, `Member.setSiteAdmin(boolean, Clock)`, `/auth/me` 응답 필드 `part`, `cohort`, `roles[{id, role, department, unit, part}]`, `permissions[]`.

- [ ] **Step 1: 마이그레이션을 쓴다**

`api/src/main/resources/db/postgresql/V5__member_roles.sql`:
```sql
ALTER TABLE member ADD COLUMN part VARCHAR(16);
ALTER TABLE member ADD COLUMN cohort INTEGER;

CREATE TABLE member_role (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY CONSTRAINT pk_member_role PRIMARY KEY,
    member_id BIGINT NOT NULL CONSTRAINT fk_member_role_member REFERENCES member (id),
    role VARCHAR(32) NOT NULL,
    department VARCHAR(32),
    unit VARCHAR(32),
    part VARCHAR(16),
    assigned_by_member_id BIGINT NOT NULL CONSTRAINT fk_member_role_assigned_by REFERENCES member (id),
    assigned_at TIMESTAMP(6) NOT NULL
);

-- 같은 직책·부서·계·파트 조합은 한 회원에게 한 번만 둡니다.
CREATE UNIQUE INDEX uq_member_role ON member_role (member_id, role, COALESCE(department, ''), COALESCE(unit, ''), COALESCE(part, ''));
CREATE INDEX ix_member_role_member ON member_role (member_id);
```

- [ ] **Step 2: 엔티티와 저장소를 만든다**

`api/src/main/java/kr/ac/jnu/choir/member/MemberRole.java`:
```java
package kr.ac.jnu.choir.member;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "member_role")
public class MemberRole {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "member_id", nullable = false)
    private Member member;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32)
    private Role role;
    @Enumerated(EnumType.STRING) @Column(length = 32)
    private Department department;
    @Enumerated(EnumType.STRING) @Column(length = 32)
    private Unit unit;
    @Enumerated(EnumType.STRING) @Column(length = 16)
    private Part part;
    @ManyToOne(optional = false) @JoinColumn(name = "assigned_by_member_id", nullable = false)
    private Member assignedBy;
    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    protected MemberRole() {}

    public MemberRole(Member member, Role role, Department department, Unit unit, Part part, Member assignedBy,
            Instant assignedAt) {
        this.member = member;
        this.role = role;
        this.department = department;
        this.unit = unit;
        this.part = part;
        this.assignedBy = assignedBy;
        this.assignedAt = assignedAt;
    }

    public Long getId() { return id; }
    public Member getMember() { return member; }
    public Role getRole() { return role; }
    public Department getDepartment() { return department; }
    public Unit getUnit() { return unit; }
    public Part getPart() { return part; }
    public Instant getAssignedAt() { return assignedAt; }
}
```

`api/src/main/java/kr/ac/jnu/choir/member/MemberRoleRepository.java`:
```java
package kr.ac.jnu.choir.member;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRoleRepository extends JpaRepository<MemberRole, Long> {
    List<MemberRole> findByMemberIdOrderByAssignedAtAsc(Long memberId);

    List<MemberRole> findByMemberIdIn(List<Long> memberIds);

    void deleteByMemberId(Long memberId);
}
```

- [ ] **Step 3: Member에 파트·기수와 사이트 관리자 변경을 더한다**

`api/src/main/java/kr/ac/jnu/choir/member/Member.java`에서 `private boolean admin;` 바로 아래에 추가:
```java
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Part part;

    @Column
    private Integer cohort;
```

`isAdmin()` 메서드 바로 아래에 추가:
```java
    public Part getPart() {
        return part;
    }

    public Integer getCohort() {
        return cohort;
    }

    public void updateProfile(Part part, Integer cohort, Clock clock) {
        this.part = part;
        this.cohort = cohort;
        updatedAt = clock.instant();
    }

    public void setSiteAdmin(boolean siteAdmin, Clock clock) {
        admin = siteAdmin;
        updatedAt = clock.instant();
    }
```

- [ ] **Step 4: PermissionService를 만든다**

`api/src/main/java/kr/ac/jnu/choir/auth/PermissionService.java`:
```java
package kr.ac.jnu.choir.auth;

import java.util.List;
import java.util.Set;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRole;
import kr.ac.jnu.choir.member.MemberRoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PermissionService {
    private final MemberRoleRepository roles;

    public PermissionService(MemberRoleRepository roles) {
        this.roles = roles;
    }

    @Transactional(readOnly = true)
    public List<MemberRole> rolesOf(Member member) {
        return roles.findByMemberIdOrderByAssignedAtAsc(member.getId());
    }

    // 요청마다 DB에서 직책을 읽으므로 직책을 바꾼 뒤 다시 로그인할 필요가 없습니다.
    @Transactional(readOnly = true)
    public Set<Permission> of(Member member) {
        if (member.getStatus() != AccountStatus.APPROVED) return Set.of();
        return Permissions.of(member.isAdmin(), member.getMemberType(),
                rolesOf(member).stream().map(MemberRole::getRole).toList());
    }
}
```

- [ ] **Step 5: 실패하는 통합 테스트를 쓴다**

`api/src/test/java/kr/ac/jnu/choir/member/MemberRoleTest.java` (처음 버전, Task 4에서 테스트를 더한다):
```java
package kr.ac.jnu.choir.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.time.Clock;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class MemberRoleTest {
    @Container static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
    }

    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MemberRepository members;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
    }

    // 승인된 활동 단원을 만들고 필요하면 사이트 관리자로 표시합니다.
    Member member(String name, boolean siteAdmin) {
        Member created = members.save(new Member(UUID.randomUUID() + "@example.org", name, "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = 'ACTIVE', admin = ?, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                siteAdmin, created.getId());
        return members.findById(created.getId()).orElseThrow();
    }

    // 직책은 테스트에서 DB에 직접 넣습니다. API로 넣는 경로는 별도 테스트에서 확인합니다.
    void grant(Member target, String role, String department, String unit, String part, Member by) {
        jdbc.update("INSERT INTO member_role (member_id, role, department, unit, part, assigned_by_member_id, assigned_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))",
                target.getId(), role, department, unit, part, by.getId());
    }

    MockHttpSession session(Member member) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return session;
    }

    String me(Member member) throws Exception {
        return mvc.perform(get("/api/v1/auth/me").session(session(member))).andReturn().getResponse().getContentAsString();
    }

    @Test void meListsRolesAndPermissions() throws Exception {
        Member admin = member("관리자", true);
        Member lead = member("수석", false);
        jdbc.update("UPDATE member SET part = 'ALTO', cohort = 2 WHERE id = ?", lead.getId());
        grant(lead, "SECTION_LEAD", null, null, "ALTO", admin);
        grant(lead, "DEPARTMENT_HEAD", "PLANNING_PR", null, null, admin);

        String body = me(lead);
        assertThat(body).contains("\"part\":\"ALTO\"").contains("\"cohort\":2")
                .contains("\"role\":\"SECTION_LEAD\"").contains("\"role\":\"DEPARTMENT_HEAD\"")
                .contains("\"department\":\"PLANNING_PR\"")
                .contains("\"MANAGE_EVENTS\"").contains("\"VIEW_MEMBERS\"").doesNotContain("\"MANAGE_ROLES\"");
        assertThat(me(member("단원", false))).contains("\"roles\":[]").contains("\"permissions\":[\"VIEW_MINUTES\"]");
        assertThat(me(admin)).contains("\"MANAGE_SITE_ADMINS\"");
    }
}
```

- [ ] **Step 6: 테스트가 실패하는지 확인한다**

Run: `cd api && ./gradlew test --tests kr.ac.jnu.choir.member.MemberRoleTest`
Expected: FAIL — 응답에 `part`, `roles`, `permissions`가 없음

- [ ] **Step 7: /auth/me 응답에 직책과 권한을 넣는다**

`api/src/main/java/kr/ac/jnu/choir/auth/AuthController.java`:
- 필드와 생성자에 `PermissionService permissions`를 추가한다(기존 생성자 매개변수 뒤에 붙이고 `this.permissions = permissions;`).
- `private static MeResponse response(Member member)`를 아래로 바꾼다(`static` 제거):
```java
    private MeResponse response(Member member) {
        List<RoleItem> roles = permissions.rolesOf(member).stream().map(role -> new RoleItem(role.getId(),
                role.getRole().name(), role.getDepartment() == null ? null : role.getDepartment().name(),
                role.getUnit() == null ? null : role.getUnit().name(),
                role.getPart() == null ? null : role.getPart().name())).toList();
        List<String> granted = permissions.of(member).stream().map(Enum::name).sorted().toList();
        return new MeResponse(member.getId(), member.getName(), member.getStatus().name(),
                member.getMemberType() == null ? null : member.getMemberType().name(), member.isAdmin(),
                member.getPart() == null ? null : member.getPart().name(), member.getCohort(), roles, granted);
    }
```
- 레코드를 바꾼다:
```java
    public record RoleItem(Long id, String role, String department, String unit, String part) {}
    public record MeResponse(Long id, String name, String status, String memberType, boolean admin,
            String part, Integer cohort, List<RoleItem> roles, List<String> permissions) {}
```
- `import java.util.List;`가 없으면 추가한다.

- [ ] **Step 8: 테스트가 통과하는지 확인한다**

Run: `cd api && ./gradlew test --tests kr.ac.jnu.choir.member.MemberRoleTest --tests kr.ac.jnu.choir.auth.OperatorAccountFlowTest`
Expected: PASS. `OperatorAccountFlowTest`는 `/auth/me`를 쓰므로 응답 필드가 늘어도 깨지지 않는지 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add api/src/main/resources/db/postgresql/V5__member_roles.sql api/src/main/java/kr/ac/jnu/choir/member/MemberRole.java api/src/main/java/kr/ac/jnu/choir/member/MemberRoleRepository.java api/src/main/java/kr/ac/jnu/choir/member/Member.java api/src/main/java/kr/ac/jnu/choir/auth/PermissionService.java api/src/main/java/kr/ac/jnu/choir/auth/AuthController.java api/src/test/java/kr/ac/jnu/choir/member/MemberRoleTest.java
git commit -m "feat: 회원 파트·기수·직책 저장과 로그인 응답의 권한 목록

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: requireAdmin을 권한별 검사로 교체

**Files:**
- Modify: `api/src/main/java/kr/ac/jnu/choir/auth/SessionMemberService.java:46-52, 54-68`
- Modify: `api/src/main/java/kr/ac/jnu/choir/auth/SecurityConfig.java:27`
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/AdminMemberController.java` (`requireAdmin` 7곳)
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/AdminAllowlistController.java:38,47,52`
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/AdminOperatorPreapprovalController.java:38,49,54`
- Modify: `api/src/main/java/kr/ac/jnu/choir/event/EventController.java:50,57,80,86`
- Modify: `api/src/main/java/kr/ac/jnu/choir/attendance/AttendanceController.java:41,48,54,61,88,95`
- Modify: `api/src/main/java/kr/ac/jnu/choir/notice/NoticeController.java:55,61,68,73`
- Modify: `api/src/main/java/kr/ac/jnu/choir/notice/NoticePollController.java:38`
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/MemberInvitationService.java:31,50,68-75`
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/MemberAllowlistService.java:37,53,60-67`
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/OperatorPreapprovalService.java:41,65,91-96`
- Test: `api/src/test/java/kr/ac/jnu/choir/security/AuthorizationMatrixTest.java`

**Interfaces:**
- Produces: `SessionMemberService.require(HttpServletRequest, Permission): Member`, `PermissionService.require(long memberId, Permission): Member`(잠금 조회 포함). `requireAdmin`은 모두 없앤다.
- 매핑: 회원 목록 → `VIEW_MEMBERS`; 초대·재발급·신청 목록·승인·반려 → `APPROVE_APPLICATIONS`; 접근 해제 → `REVOKE_ACCESS`; 자동 승인 명단 → `MANAGE_ALLOWLIST`; 운영진 사전 등록 → `MANAGE_SITE_ADMINS`; 행사 등록·일괄 등록·수정·응답 집계, 공지 관리, 투표 결과, 출석 창·정정 → `MANAGE_EVENTS`(②단계에서 전체연습·파트연습을 세분한다).

- [ ] **Step 1: 권한 표 테스트에 직책 행을 더한다**

`api/src/test/java/kr/ac/jnu/choir/security/AuthorizationMatrixTest.java`의 `session(String status, String type, boolean admin)` 아래에 추가:
```java
    // 직책을 DB에 직접 넣은 활동 단원 세션입니다.
    private MockHttpSession staff(String role) {
        MockHttpSession session = session("APPROVED", "ACTIVE", false);
        Long id = (Long) session.getAttribute("memberId");
        jdbc.update("INSERT INTO member_role (member_id, role, assigned_by_member_id, assigned_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP(6))",
                id, role, id);
        return session;
    }
```
`roleMatrixProtectsMemberAndAdminReads`의 `roles` 목록 끝(`new Role("운영진", ...)` 뒤)에 추가:
```java
                new Role("수석", staff("SECTION_LEAD"), 200, 200),
                new Role("단장", staff("PRESIDENT"), 200, 200)
```
그리고 같은 테스트 끝에 추가(`for` 루프 뒤):
```java
        // 회원 목록과 접근 해제는 직책에 따라 갈립니다.
        assertThat(getStatus("/api/v1/admin/members", staff("SECTION_LEAD"))).isEqualTo(200);
        assertThat(getStatus("/api/v1/admin/allowlist", staff("SECTION_LEAD"))).isEqualTo(403);
        assertThat(getStatus("/api/v1/admin/allowlist", staff("PRESIDENT"))).isEqualTo(200);
        assertThat(getStatus("/api/v1/admin/operator-preapprovals", staff("PRESIDENT"))).isEqualTo(403);
        assertThat(getStatus("/api/v1/admin/operator-preapprovals", session("APPROVED", "ACTIVE", true))).isEqualTo(200);
```
`adminPaths`의 `/api/v1/admin/applications`는 수석에게 403이어야 하므로, `adminPaths`에서 `"/api/v1/admin/applications"`를 빼고 아래 줄을 `for` 루프 뒤에 추가:
```java
        assertThat(getStatus("/api/v1/admin/applications", staff("SECTION_LEAD"))).isEqualTo(403);
        assertThat(getStatus("/api/v1/admin/applications", staff("VICE_PRESIDENT"))).isEqualTo(200);
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd api && ./gradlew test --tests kr.ac.jnu.choir.security.AuthorizationMatrixTest`
Expected: FAIL — 수석·단장 세션이 `/api/v1/admin/**`에서 403 (`hasRole("ADMIN")` 때문)

- [ ] **Step 3: SessionMemberService와 SecurityConfig를 바꾼다**

`SessionMemberService.java`: 생성자에 `PermissionService permissions`를 추가하고 `requireAdmin`을 아래로 교체한다.
```java
    public Member require(HttpServletRequest request, Permission permission) {
        Member member = requireApproved(request);
        if (!permissions.of(member).contains(permission)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다.");
        }
        return member;
    }
```
`authenticateRequest`에서 `if (member.isAdmin()) authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));` 줄을 지운다.

`PermissionService.java`에 추가(서비스 안에서 잠금 조회로 다시 확인할 때 쓴다):
```java
    @Transactional
    public Member require(long memberId, Permission permission) {
        Member actor = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다."));
        if (!of(actor).contains(permission)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다.");
        }
        return actor;
    }
```
생성자에 `MemberRepository members`를 추가하고 `import kr.ac.jnu.choir.common.ApiException; import kr.ac.jnu.choir.member.MemberRepository; import org.springframework.http.HttpStatus;`를 더한다.

`SecurityConfig.java:27`: `.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")`을 `.requestMatchers("/api/v1/admin/**").hasRole("MEMBER")`로 바꾼다. 각 엔드포인트가 권한을 검사하므로 경로 단위 검사는 승인 여부만 본다.

- [ ] **Step 4: 컨트롤러의 requireAdmin을 교체한다**

각 파일에 `import kr.ac.jnu.choir.auth.Permission;`을 추가하고 다음과 같이 바꾼다.

`AdminMemberController.java`:
- `members(...)`: `sessions.require(request, Permission.VIEW_MEMBERS);`
- `invite`, `reissue`, `applications`, `approve`, `reject`: `sessions.require(request, Permission.APPROVE_APPLICATIONS)`
- `revoke`: `sessions.require(request, Permission.REVOKE_ACCESS)`

`AdminAllowlistController.java` 세 곳: `sessions.require(request, Permission.MANAGE_ALLOWLIST)`
`AdminOperatorPreapprovalController.java` 세 곳: `sessions.require(request, Permission.MANAGE_SITE_ADMINS)`
`EventController.java` 네 곳, `AttendanceController.java` 여섯 곳, `NoticeController.java` 네 곳, `NoticePollController.java` 한 곳: `sessions.require(request, Permission.MANAGE_EVENTS)`

- [ ] **Step 5: 서비스 안의 requireAdmin을 교체한다**

`MemberInvitationService.java`: 생성자에 `PermissionService permissions`를 추가하고, `requireAdmin(requestedBy.getId())` 두 곳을 `permissions.require(requestedBy.getId(), Permission.APPROVE_APPLICATIONS)`로 바꾼 뒤 `private Member requireAdmin(long id)` 메서드를 지운다.
`MemberAllowlistService.java`: 같은 방식으로 `permissions.require(actorId, Permission.MANAGE_ALLOWLIST)`.
`OperatorPreapprovalService.java`: 같은 방식으로 `permissions.require(actorId, Permission.MANAGE_SITE_ADMINS)`. `adminRequired()` 도우미가 다른 곳에서 쓰이지 않으면 함께 지운다.

`grep -rn "requireAdmin\|ROLE_ADMIN" api/src/main`이 아무것도 찾지 않아야 한다.

- [ ] **Step 6: API 테스트 전체를 돌린다**

Run: `cd api && ./gradlew test`
Expected: PASS. `MemberApprovalTest`, `OperatorAccountFlowTest`, `NoticeAccessTest` 등 기존 테스트는 `admin = true` 세션을 쓰므로 사이트 관리자로 그대로 통과해야 한다. 실패하면 메시지 코드가 `ADMIN_REQUIRED`에서 `PERMISSION_REQUIRED`로 바뀐 영향인지 확인하고 테스트의 기대 문자열을 고친다.

- [ ] **Step 7: 커밋**

```bash
git add api/src
git commit -m "refactor: 운영진 여부 대신 권한별로 API 접근을 검사

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 직책·프로필·사이트 관리자 변경 API

**Files:**
- Create: `api/src/main/java/kr/ac/jnu/choir/member/MemberRoleService.java`
- Create: `api/src/main/java/kr/ac/jnu/choir/member/AdminMemberRoleController.java`
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/AdminMemberController.java:44-52` (목록 응답에 파트·기수·직책)
- Modify: `api/src/main/java/kr/ac/jnu/choir/member/MemberApprovalService.java` (`revoke`에서 직책 삭제)
- Test: `api/src/test/java/kr/ac/jnu/choir/member/MemberRoleTest.java`

**Interfaces:**
- Produces:
  - `PUT /api/v1/admin/members/{id}/profile` body `{part: Part|null, cohort: int|null}` → 204, 권한 `MANAGE_ROLES`
  - `POST /api/v1/admin/members/{id}/roles` body `{role, department?, unit?, part?}` → 201 `{id, role, department, unit, part}`, 권한 `MANAGE_ROLES`(단장·부단장 직책은 `MANAGE_SITE_ADMINS`)
  - `DELETE /api/v1/admin/members/{id}/roles/{roleId}` → 204, 같은 권한 규칙
  - `PUT /api/v1/admin/members/{id}/site-admin` body `{admin: boolean}` → 204, 권한 `MANAGE_SITE_ADMINS`, 자기 자신 해제 불가
  - 회원 목록 항목에 `part`, `cohort`, `roles[{id, role, department, unit, part}]` 추가
- 오류: 대상이 승인된 활동 단원이 아니면 409 `ROLE_NOT_ALLOWED`; 부서·계·파트 조합이 맞지 않으면 400 `INVALID_ROLE`; 중복이면 409 `ROLE_EXISTS`.

- [ ] **Step 1: 실패하는 테스트를 더한다**

`MemberRoleTest.java`에 도우미와 테스트를 추가한다. 클래스 안 `me(...)` 아래:
```java
    record Caller(MockHttpSession session, String token) {}

    Caller caller(Member member) throws Exception {
        var csrf = mvc.perform(get("/api/v1/auth/csrf").session(session(member))).andReturn();
        String token = csrf.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        return new Caller((MockHttpSession) csrf.getRequest().getSession(false), token);
    }

    int post(Caller caller, String path, String body) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path).session(caller.session())
                .header("X-CSRF-TOKEN", caller.token()).contentType("application/json").content(body))
                .andReturn().getResponse().getStatus();
    }

    int put(Caller caller, String path, String body) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path).session(caller.session())
                .header("X-CSRF-TOKEN", caller.token()).contentType("application/json").content(body))
                .andReturn().getResponse().getStatus();
    }

    int delete(Caller caller, String path) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(path).session(caller.session())
                .header("X-CSRF-TOKEN", caller.token())).andReturn().getResponse().getStatus();
    }

    @Test void presidentAssignsStaffRolesButOnlySiteAdminAssignsLeadership() throws Exception {
        Member admin = member("관리자", true);
        Member president = member("단장", false);
        grant(president, "PRESIDENT", null, null, null, admin);
        Member target = member("단원", false);
        Caller byPresident = caller(president);

        assertThat(post(byPresident, "/api/v1/admin/members/" + target.getId() + "/roles",
                "{\"role\":\"SECTION_LEAD\",\"part\":\"TENOR\"}")).isEqualTo(201);
        assertThat(post(byPresident, "/api/v1/admin/members/" + target.getId() + "/roles",
                "{\"role\":\"SECTION_LEAD\",\"part\":\"TENOR\"}")).isEqualTo(409);
        assertThat(post(byPresident, "/api/v1/admin/members/" + target.getId() + "/roles",
                "{\"role\":\"DEPARTMENT_MEMBER\",\"department\":\"MANAGEMENT\",\"unit\":\"PR\"}")).isEqualTo(400);
        assertThat(post(byPresident, "/api/v1/admin/members/" + target.getId() + "/roles",
                "{\"role\":\"VICE_PRESIDENT\"}")).isEqualTo(403);
        assertThat(post(caller(admin), "/api/v1/admin/members/" + target.getId() + "/roles",
                "{\"role\":\"VICE_PRESIDENT\"}")).isEqualTo(201);
        assertThat(put(byPresident, "/api/v1/admin/members/" + target.getId() + "/profile",
                "{\"part\":\"TENOR\",\"cohort\":3}")).isEqualTo(204);
        assertThat(me(target)).contains("\"MANAGE_FULL_REHEARSALS\"").contains("\"cohort\":3");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_action_log WHERE target_member_id = ? AND action = 'ROLE_ASSIGN'",
                Long.class, target.getId())).isEqualTo(2);
    }

    @Test void staffCannotAssignRolesAndObCannotReceiveThem() throws Exception {
        Member admin = member("관리자", true);
        Member lead = member("수석", false);
        grant(lead, "SECTION_LEAD", null, null, "BASS", admin);
        Member ob = member("졸업 단원", false);
        jdbc.update("UPDATE member SET member_type = 'OB' WHERE id = ?", ob.getId());
        assertThat(post(caller(lead), "/api/v1/admin/members/" + ob.getId() + "/roles", "{\"role\":\"TREASURER\"}")).isEqualTo(403);
        assertThat(post(caller(admin), "/api/v1/admin/members/" + ob.getId() + "/roles", "{\"role\":\"TREASURER\"}")).isEqualTo(409);
    }

    @Test void revokeRemovesRolesAndSiteAdminCannotDemoteSelf() throws Exception {
        Member admin = member("관리자", true);
        Member target = member("총무", false);
        grant(target, "TREASURER", null, null, null, admin);
        Caller byAdmin = caller(admin);
        assertThat(put(byAdmin, "/api/v1/admin/members/" + admin.getId() + "/site-admin", "{\"admin\":false}")).isEqualTo(409);
        assertThat(put(byAdmin, "/api/v1/admin/members/" + target.getId() + "/site-admin", "{\"admin\":true}")).isEqualTo(204);
        assertThat(me(target)).contains("\"admin\":true");
        assertThat(put(byAdmin, "/api/v1/admin/members/" + target.getId() + "/site-admin", "{\"admin\":false}")).isEqualTo(204);
        assertThat(post(byAdmin, "/api/v1/admin/members/" + target.getId() + "/revoke", "{\"reason\":\"활동 종료\"}")).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM member_role WHERE member_id = ?", Long.class, target.getId())).isZero();
    }

    @Test void memberListIncludesRoles() throws Exception {
        Member admin = member("관리자", true);
        Member lead = member("수석", false);
        grant(lead, "SECTION_LEAD", null, null, "SOPRANO", admin);
        String body = mvc.perform(get("/api/v1/admin/members?page=0&size=100").session(session(admin)))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).contains("\"role\":\"SECTION_LEAD\",\"department\":null,\"unit\":null,\"part\":\"SOPRANO\"");
    }
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd api && ./gradlew test --tests kr.ac.jnu.choir.member.MemberRoleTest`
Expected: FAIL — 새 경로가 404

- [ ] **Step 3: MemberRoleService를 만든다**

`api/src/main/java/kr/ac/jnu/choir/member/MemberRoleService.java`:
```java
package kr.ac.jnu.choir.member;

import java.time.Clock;
import kr.ac.jnu.choir.auth.Permission;
import kr.ac.jnu.choir.auth.PermissionService;
import kr.ac.jnu.choir.common.AdminActionLog;
import kr.ac.jnu.choir.common.AdminActionLogRepository;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberRoleService {
    private final MemberRepository members;
    private final MemberRoleRepository roles;
    private final PermissionService permissions;
    private final AdminActionLogRepository logs;
    private final Clock clock;

    public MemberRoleService(MemberRepository members, MemberRoleRepository roles, PermissionService permissions,
            AdminActionLogRepository logs, Clock clock) {
        this.members = members;
        this.roles = roles;
        this.permissions = permissions;
        this.logs = logs;
        this.clock = clock;
    }

    @Transactional
    public MemberRole assign(long actorId, long targetId, Role role, Department department, Unit unit, Part part) {
        Member actor = permissions.require(actorId, required(role));
        validate(role, department, unit, part);
        Member target = eligible(targetId);
        MemberRole created;
        try {
            created = roles.saveAndFlush(new MemberRole(target, role, department, unit, part, actor, clock.instant()));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "ROLE_EXISTS", "이미 가진 직책입니다.");
        }
        logs.save(new AdminActionLog(actor, target, "ROLE_ASSIGN", target.getStatus(), target.getStatus(),
                describe(role, department, unit, part), clock.instant()));
        return created;
    }

    @Transactional
    public void remove(long actorId, long targetId, long roleId) {
        MemberRole existing = roles.findById(roleId)
                .filter(role -> role.getMember().getId().equals(targetId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "직책을 찾을 수 없습니다."));
        Member actor = permissions.require(actorId, required(existing.getRole()));
        Member target = existing.getMember();
        roles.delete(existing);
        logs.save(new AdminActionLog(actor, target, "ROLE_REMOVE", target.getStatus(), target.getStatus(),
                describe(existing.getRole(), existing.getDepartment(), existing.getUnit(), existing.getPart()), clock.instant()));
    }

    @Transactional
    public void updateProfile(long actorId, long targetId, Part part, Integer cohort) {
        Member actor = permissions.require(actorId, Permission.MANAGE_ROLES);
        if (cohort != null && cohort < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_COHORT", "기수는 1 이상이어야 합니다.");
        }
        Member target = members.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
        target.updateProfile(part, cohort, clock);
        logs.save(new AdminActionLog(actor, target, "PROFILE_UPDATE", target.getStatus(), target.getStatus(),
                (part == null ? "파트 없음" : part.name()) + ", 기수 " + (cohort == null ? "없음" : cohort), clock.instant()));
    }

    @Transactional
    public void setSiteAdmin(long actorId, long targetId, boolean siteAdmin) {
        Member actor = permissions.require(actorId, Permission.MANAGE_SITE_ADMINS);
        if (actorId == targetId && !siteAdmin) {
            throw new ApiException(HttpStatus.CONFLICT, "SELF_DEMOTION", "자기 자신의 사이트 관리자 권한은 해제할 수 없습니다.");
        }
        Member target = siteAdmin ? eligible(targetId) : members.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
        target.setSiteAdmin(siteAdmin, clock);
        logs.save(new AdminActionLog(actor, target, siteAdmin ? "SITE_ADMIN_GRANT" : "SITE_ADMIN_REVOKE",
                target.getStatus(), target.getStatus(), null, clock.instant()));
    }

    // 단장·부단장 지정은 사이트 관리자만, 나머지 직책은 직책 관리 권한으로 합니다.
    private static Permission required(Role role) {
        return role == Role.PRESIDENT || role == Role.VICE_PRESIDENT ? Permission.MANAGE_SITE_ADMINS : Permission.MANAGE_ROLES;
    }

    private static void validate(Role role, Department department, Unit unit, Part part) {
        boolean valid = switch (role) {
            case DEPARTMENT_HEAD -> department != null && unit == null && part == null;
            case DEPARTMENT_MEMBER -> department != null && unit != null && unit.department() == department && part == null;
            case SECTION_LEAD -> part != null && department == null && unit == null;
            default -> department == null && unit == null && part == null;
        };
        if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "직책과 부서·계·파트 조합을 확인해 주세요.");
    }

    private Member eligible(long targetId) {
        Member target = members.findByIdForUpdate(targetId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "계정을 찾을 수 없습니다."));
        if (target.getStatus() != AccountStatus.APPROVED || target.getMemberType() != MemberType.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "ROLE_NOT_ALLOWED", "승인된 활동 단원에게만 직책을 줄 수 있습니다.");
        }
        return target;
    }

    private static String describe(Role role, Department department, Unit unit, Part part) {
        return role.name() + (department == null ? "" : " " + department.name()) + (unit == null ? "" : " " + unit.name())
                + (part == null ? "" : " " + part.name());
    }
}
```

- [ ] **Step 4: 컨트롤러를 만든다**

`api/src/main/java/kr/ac/jnu/choir/member/AdminMemberRoleController.java`:
```java
package kr.ac.jnu.choir.member;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import kr.ac.jnu.choir.auth.SessionMemberService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/members/{id}")
public class AdminMemberRoleController {
    private final SessionMemberService sessions;
    private final MemberRoleService service;

    public AdminMemberRoleController(SessionMemberService sessions, MemberRoleService service) {
        this.sessions = sessions;
        this.service = service;
    }

    // 권한은 직책 종류에 따라 다르므로 서비스가 검사합니다. 여기서는 승인된 회원인지만 봅니다.
    @PostMapping("/roles")
    public ResponseEntity<RoleItem> assign(HttpServletRequest request, @PathVariable long id, @Valid @RequestBody RoleInput body) {
        long actor = sessions.requireApproved(request).getId();
        return ResponseEntity.status(HttpStatus.CREATED).body(item(service.assign(actor, id, body.role(),
                body.department(), body.unit(), body.part())));
    }

    @DeleteMapping("/roles/{roleId}")
    public ResponseEntity<Void> remove(HttpServletRequest request, @PathVariable long id, @PathVariable long roleId) {
        service.remove(sessions.requireApproved(request).getId(), id, roleId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/profile")
    public ResponseEntity<Void> profile(HttpServletRequest request, @PathVariable long id, @RequestBody ProfileInput body) {
        service.updateProfile(sessions.requireApproved(request).getId(), id, body.part(), body.cohort());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/site-admin")
    public ResponseEntity<Void> siteAdmin(HttpServletRequest request, @PathVariable long id, @Valid @RequestBody SiteAdminInput body) {
        service.setSiteAdmin(sessions.requireApproved(request).getId(), id, body.admin());
        return ResponseEntity.noContent().build();
    }

    static RoleItem item(MemberRole role) {
        return new RoleItem(role.getId(), role.getRole(), role.getDepartment(), role.getUnit(), role.getPart());
    }

    public record RoleInput(@NotNull Role role, Department department, Unit unit, Part part) {}
    public record ProfileInput(Part part, Integer cohort) {}
    public record SiteAdminInput(@NotNull Boolean admin) {}
    public record RoleItem(Long id, Role role, Department department, Unit unit, Part part) {}
}
```

- [ ] **Step 5: 회원 목록에 파트·기수·직책을 넣고, 접근 해제에서 직책을 지운다**

`AdminMemberController.java`: 생성자에 `MemberRoleRepository roles`를 추가한다. `members(...)`의 응답 생성을 아래로 바꾼다.
```java
        Page<Member> result = members.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
        var rolesByMember = roles.findByMemberIdIn(result.getContent().stream().map(Member::getId).toList()).stream()
                .collect(java.util.stream.Collectors.groupingBy(role -> role.getMember().getId()));
        return new MemberPage(result.getContent().stream().map(member -> new MemberItem(member.getId(),
                member.getName(), member.getEmail(), member.getStatus(), member.getMemberType(),
                member.isAdmin(), member.getGoogleSubject() != null, member.getCreatedAt(),
                member.getPart(), member.getCohort(),
                rolesByMember.getOrDefault(member.getId(), List.of()).stream()
                        .map(AdminMemberRoleController::item).toList())).toList(), page, size, result.getTotalElements());
```
`MemberItem` 레코드를 바꾼다:
```java
    public record MemberItem(Long id, String name, String email, AccountStatus status,
            MemberType memberType, boolean admin, boolean googleLinked, Instant createdAt,
            Part part, Integer cohort, List<AdminMemberRoleController.RoleItem> roles) {}
```

`MemberApprovalService.java`: 생성자에 `MemberRoleRepository roles`를 추가하고, `revoke(...)`에서 `target.revoke(clock);` 바로 뒤에 `roles.deleteByMemberId(target.getId());`를 넣는다. (`revoke` 메서드가 `target.revoke(clock)`을 호출하는 줄을 찾아 그 아래에 추가한다.)

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `cd api && ./gradlew test --tests kr.ac.jnu.choir.member.MemberRoleTest --tests kr.ac.jnu.choir.member.MemberApprovalTest`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add api/src
git commit -m "feat: 직책·파트·기수·사이트 관리자 변경 API

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 웹 세션 권한과 메뉴 가리기

**Files:**
- Modify: `web/src/features/auth/session.ts:3-9`
- Create: `web/src/features/member/roles.ts`
- Modify: `web/src/features/member/MemberNavigation.tsx:60`
- Modify: `web/src/features/member/AdminNavigation.tsx`
- Test: `web/src/features/member/AdminNavigation.test.tsx` (새로 만듦)

**Interfaces:**
- Produces: `MemberSession`에 `part: Part | null`, `cohort: number | null`, `roles: MemberRoleItem[]`, `permissions: Permission[]`; `can(session: MemberSession | null, permission: Permission): boolean` — 사이트 관리자(`admin`)이면 항상 참; `roles.ts`의 `roleLabel`, `partLabel`, `departmentLabel`, `unitLabel`, `describeRole(role)`.

- [ ] **Step 1: 세션 타입과 can()을 추가한다**

`web/src/features/auth/session.ts`의 `MemberSession`을 아래로 바꾸고 `can`을 추가한다.
```ts
export type Part = "SOPRANO" | "ALTO" | "TENOR" | "BASS" | "PIANO";
export type Role = "PRESIDENT" | "VICE_PRESIDENT" | "TREASURER" | "DEPARTMENT_HEAD" | "DEPARTMENT_MEMBER" | "SECTION_LEAD";
export type Department = "PLANNING_PR" | "MANAGEMENT";
export type Unit = "PLANNING" | "PR" | "SCORES" | "SUPPLIES";
export type Permission = "MANAGE_SITE_ADMINS" | "MANAGE_ROLES" | "REVOKE_ACCESS" | "MANAGE_ALLOWLIST"
  | "APPROVE_APPLICATIONS" | "MANAGE_FULL_REHEARSALS" | "MANAGE_PART_REHEARSALS" | "MANAGE_EVENTS"
  | "WRITE_MINUTES" | "DELETE_MINUTES" | "VIEW_MEMBERS" | "VIEW_MINUTES";
export type MemberRoleItem = { id: number; role: Role; department: Department | null; unit: Unit | null; part: Part | null };

export type MemberSession = {
  id: number;
  name: string;
  status: "INVITED" | "EMAIL_PENDING" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  memberType: "ACTIVE" | "OB" | null;
  admin: boolean;
  part?: Part | null;
  cohort?: number | null;
  roles?: MemberRoleItem[];
  permissions?: Permission[];
};

// 사이트 관리자는 모든 권한을 가집니다. 서버가 권한 목록을 함께 주지만 화면은 이 함수로만 판단합니다.
export function can(session: MemberSession | null | undefined, permission: Permission): boolean {
  return Boolean(session && (session.admin || session.permissions?.includes(permission)));
}

// 회원 메뉴에 "운영진"을 보여 줄지 정합니다. 회의록 보기는 모든 활동 단원의 권한이라 제외합니다.
export function isStaff(session: MemberSession | null | undefined): boolean {
  return Boolean(session && (session.admin || session.permissions?.some((permission) => permission !== "VIEW_MINUTES")));
}
```
`part`, `cohort`, `roles`, `permissions`를 선택 속성으로 둔 이유: 기존 테스트의 세션 목업이 네 값을 넣지 않아도 되게 하기 위해서다.

- [ ] **Step 2: 한글 이름 목록을 만든다**

`web/src/features/member/roles.ts`:
```ts
import type { Department, MemberRoleItem, Part, Role, Unit } from "../auth/session";

export const partLabel: Record<Part, string> = { SOPRANO: "소프라노", ALTO: "알토", TENOR: "테너", BASS: "베이스", PIANO: "피아노" };
export const roleLabel: Record<Role, string> = {
  PRESIDENT: "단장", VICE_PRESIDENT: "부단장", TREASURER: "총무", DEPARTMENT_HEAD: "부장", DEPARTMENT_MEMBER: "부원", SECTION_LEAD: "수석",
};
export const departmentLabel: Record<Department, string> = { PLANNING_PR: "기획·홍보부", MANAGEMENT: "관리부" };
export const unitLabel: Record<Unit, string> = { PLANNING: "기획계", PR: "홍보계", SCORES: "악보계", SUPPLIES: "비품계" };
export const unitsOf: Record<Department, Unit[]> = { PLANNING_PR: ["PLANNING", "PR"], MANAGEMENT: ["SCORES", "SUPPLIES"] };
export const parts = Object.keys(partLabel) as Part[];
export const roles = Object.keys(roleLabel) as Role[];
export const departments = Object.keys(departmentLabel) as Department[];

// "소프라노수석", "기획·홍보부 부장", "관리부 악보계 부원"처럼 안내문과 같은 표기를 만듭니다.
export function describeRole(item: Pick<MemberRoleItem, "role" | "department" | "unit" | "part">): string {
  if (item.role === "SECTION_LEAD" && item.part) return `${partLabel[item.part]}수석`;
  if (item.role === "DEPARTMENT_HEAD" && item.department) return `${departmentLabel[item.department]} 부장`;
  if (item.role === "DEPARTMENT_MEMBER" && item.department && item.unit) return `${departmentLabel[item.department]} ${unitLabel[item.unit]} 부원`;
  return roleLabel[item.role];
}
```

- [ ] **Step 3: 실패하는 메뉴 테스트를 쓴다**

`web/src/features/member/AdminNavigation.test.tsx`:
```tsx
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminNavigation } from "./AdminNavigation";
import { getSession } from "../auth/session";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/events" }));
vi.mock("../auth/session", async (original) => ({ ...(await original<typeof import("../auth/session")>()), getSession: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("수석에게는 공지·행사 관리와 단원 계정만 보입니다", async () => {
  vi.mocked(getSession).mockResolvedValue({ id: 3, name: "수석", status: "APPROVED", memberType: "ACTIVE", admin: false,
    permissions: ["MANAGE_EVENTS", "WRITE_MINUTES", "VIEW_MEMBERS", "VIEW_MINUTES"] });
  render(<AdminNavigation />);
  expect(await screen.findByRole("link", { name: "행사 관리" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "단원 계정" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "가입 승인" })).not.toBeInTheDocument();
});

test("사이트 관리자에게는 모든 메뉴가 보입니다", async () => {
  vi.mocked(getSession).mockResolvedValue({ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true });
  render(<AdminNavigation />);
  expect(await screen.findByRole("link", { name: "가입 승인" })).toBeInTheDocument();
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인한다**

Run: `cd web && npx vitest run src/features/member/AdminNavigation.test.tsx`
Expected: FAIL — 수석에게도 "가입 승인"이 보임

- [ ] **Step 5: 메뉴를 권한으로 가린다**

`web/src/features/member/AdminNavigation.tsx`를 아래로 바꾼다.
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, getSession, type MemberSession, type Permission } from "../auth/session";
import styles from "./MemberNavigation.module.css";

const links: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin/members", label: "단원 계정", permission: "VIEW_MEMBERS" },
  { href: "/admin/applications", label: "가입 승인", permission: "APPROVE_APPLICATIONS" },
  { href: "/admin/notices", label: "공지 관리", permission: "MANAGE_EVENTS" },
  { href: "/admin/events", label: "행사 관리", permission: "MANAGE_EVENTS" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const [session, setSession] = useState<MemberSession | null>(null);

  useEffect(() => {
    let active = true;
    getSession().then((value) => { if (active) setSession(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return <nav className={styles.subnav} aria-label="운영진 메뉴">
    <div className={styles.subnavInner}>{links.filter((link) => can(session, link.permission)).map(({ href, label }) => <Link key={href} href={href}
      aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>{label}</Link>)}</div>
  </nav>;
}
```

`web/src/features/member/MemberNavigation.tsx:60`의 `{session?.admin && <Link href="/admin/events" ...>운영진</Link>}`를 `{isStaff(session) && <Link href="/admin/events" ...>운영진</Link>}`로 바꾸고, import에 `isStaff`를 추가한다. 운영진 첫 화면 `/admin/events`는 모든 집행부·수석진이 `MANAGE_EVENTS`를 가지므로 그대로 둔다.

- [ ] **Step 6: 테스트·린트·타입 검사**

Run: `cd web && npx vitest run src/features/member && npx eslint src/features && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add web/src/features/auth/session.ts web/src/features/member/roles.ts web/src/features/member/AdminNavigation.tsx web/src/features/member/AdminNavigation.test.tsx web/src/features/member/MemberNavigation.tsx
git commit -m "feat: 로그인 세션의 권한 목록으로 운영진 메뉴 표시

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 단원 계정 화면의 직책 편집

**Files:**
- Modify: `web/src/features/member/adminMembers.ts` (`MemberItem`과 새 함수)
- Create: `web/src/features/member/MemberRoles.tsx`
- Create: `web/src/features/member/MemberRoles.test.tsx`
- Modify: `web/src/features/member/MemberAccountManager.tsx:98-170`
- Modify: `web/src/features/member/MemberRegistration.tsx` (체크박스 문구와 표시 조건)
- Modify: `web/src/features/member/MemberRegistration.test.tsx` (문구)
- Modify: `web/src/features/member/AdminPages.module.css` (직책 칩 스타일)

**Interfaces:**
- Produces: `adminMembers.ts`의 `updateMemberProfile(id, {part, cohort})`, `assignMemberRole(id, {role, department?, unit?, part?}): Promise<MemberRoleItem>`, `removeMemberRole(id, roleId)`, `setSiteAdmin(id, admin)`; `MemberItem`에 `part`, `cohort`, `roles` 추가; `<MemberRoles item={MemberItem} session={MemberSession} onChanged={() => void} />`.
- Consumes: Task 4의 API, Task 5의 `can`, `roles.ts`.

- [ ] **Step 1: API 함수와 타입을 더한다**

`web/src/features/member/adminMembers.ts`의 `MemberItem`에 세 필드를 추가한다.
```ts
import type { Department, MemberRoleItem, Part, Role, Unit } from "../auth/session";
// ...MemberItem 안 createdAt 아래:
  part: Part | null;
  cohort: number | null;
  roles: MemberRoleItem[];
```
파일 끝에 추가:
```ts
export function updateMemberProfile(id: number, input: { part: Part | null; cohort: number | null }): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/profile`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function assignMemberRole(id: number, input: { role: Role; department?: Department; unit?: Unit; part?: Part }): Promise<MemberRoleItem> {
  return apiRequest<MemberRoleItem>(`/admin/members/${id}/roles`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function removeMemberRole(id: number, roleId: number): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/roles/${roleId}`, { method: "DELETE" });
}

export function setSiteAdmin(id: number, admin: boolean): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/site-admin`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin }),
  });
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`web/src/features/member/MemberRoles.test.tsx`:
```tsx
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberRoles } from "./MemberRoles";
import { assignMemberRole, removeMemberRole, updateMemberProfile, type MemberItem } from "./adminMembers";
import type { MemberSession } from "../auth/session";

vi.mock("./adminMembers", () => ({ assignMemberRole: vi.fn(), removeMemberRole: vi.fn(), updateMemberProfile: vi.fn(), setSiteAdmin: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const president: MemberSession = { id: 1, name: "단장", status: "APPROVED", memberType: "ACTIVE", admin: false,
  permissions: ["MANAGE_ROLES", "REVOKE_ACCESS", "MANAGE_ALLOWLIST", "APPROVE_APPLICATIONS", "MANAGE_EVENTS", "VIEW_MEMBERS", "VIEW_MINUTES"] };
const item: MemberItem = { id: 7, name: "단원", email: "member@example.test", status: "APPROVED", memberType: "ACTIVE",
  admin: false, googleLinked: true, createdAt: "2026-09-01T00:00:00Z", part: "ALTO", cohort: 2,
  roles: [{ id: 11, role: "SECTION_LEAD", department: null, unit: null, part: "ALTO" }] };

test("직책을 한글로 보여 주고 해제합니다", async () => {
  vi.mocked(removeMemberRole).mockResolvedValue(undefined);
  const onChanged = vi.fn();
  render(<MemberRoles item={item} session={president} onChanged={onChanged} />);
  expect(screen.getByText("알토수석")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "알토수석 해제" }));
  expect(removeMemberRole).toHaveBeenCalledWith(7, 11);
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});

test("부원은 부서와 계를 함께 골라 추가합니다", async () => {
  vi.mocked(assignMemberRole).mockResolvedValue({ id: 12, role: "DEPARTMENT_MEMBER", department: "MANAGEMENT", unit: "SCORES", part: null });
  render(<MemberRoles item={item} session={president} onChanged={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("추가할 직책"), "DEPARTMENT_MEMBER");
  await userEvent.selectOptions(screen.getByLabelText("부서"), "MANAGEMENT");
  await userEvent.selectOptions(screen.getByLabelText("계"), "SCORES");
  await userEvent.click(screen.getByRole("button", { name: "직책 추가" }));
  expect(assignMemberRole).toHaveBeenCalledWith(7, { role: "DEPARTMENT_MEMBER", department: "MANAGEMENT", unit: "SCORES" });
});

test("단장은 부단장 직책을 고를 수 없고 사이트 관리자 전환도 보이지 않습니다", () => {
  render(<MemberRoles item={item} session={president} onChanged={vi.fn()} />);
  const options = [...screen.getByLabelText<HTMLSelectElement>("추가할 직책").options].map((option) => option.value);
  expect(options).not.toContain("VICE_PRESIDENT");
  expect(options).toContain("TREASURER");
  expect(screen.queryByRole("button", { name: /사이트 관리자/ })).not.toBeInTheDocument();
});

test("파트와 기수를 저장합니다", async () => {
  vi.mocked(updateMemberProfile).mockResolvedValue(undefined);
  render(<MemberRoles item={item} session={president} onChanged={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("파트"), "TENOR");
  await userEvent.clear(screen.getByLabelText("기수"));
  await userEvent.type(screen.getByLabelText("기수"), "3");
  await userEvent.click(screen.getByRole("button", { name: "파트·기수 저장" }));
  expect(updateMemberProfile).toHaveBeenCalledWith(7, { part: "TENOR", cohort: 3 });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `cd web && npx vitest run src/features/member/MemberRoles.test.tsx`
Expected: FAIL — `MemberRoles` 모듈 없음

- [ ] **Step 4: MemberRoles를 만든다**

`web/src/features/member/MemberRoles.tsx`:
```tsx
"use client";

import { Button, Input, Select, Feedback, StatusBadge } from "../../components/ui";

import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { can, type Department, type MemberSession, type Part, type Role, type Unit } from "../auth/session";
import { assignMemberRole, removeMemberRole, setSiteAdmin, updateMemberProfile, type MemberItem } from "./adminMembers";
import { departmentLabel, departments, describeRole, partLabel, parts, roleLabel, roles, unitLabel, unitsOf } from "./roles";
import styles from "./AdminPages.module.css";

export function MemberRoles({ item, session, onChanged }: { item: MemberItem; session: MemberSession; onChanged: () => void }) {
  const [role, setRole] = useState<Role>("TREASURER");
  const [department, setDepartment] = useState<Department>("PLANNING_PR");
  const [unit, setUnit] = useState<Unit>("PLANNING");
  const [part, setPart] = useState<Part>("SOPRANO");
  const [profilePart, setProfilePart] = useState<Part | "">(item.part ?? "");
  const [cohort, setCohort] = useState(item.cohort === null ? "" : String(item.cohort));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const leadership = can(session, "MANAGE_SITE_ADMINS");
  const eligible = item.status === "APPROVED" && item.memberType === "ACTIVE";
  // 단장·부단장은 사이트 관리자만 지정합니다.
  const choices = roles.filter((value) => leadership || (value !== "PRESIDENT" && value !== "VICE_PRESIDENT"));

  async function run(action: () => Promise<unknown>, failure: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); onChanged(); }
    catch (caught) { setError(caught instanceof ApiRequestError ? caught.message : failure); }
    finally { setBusy(false); }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = role === "SECTION_LEAD" ? { role, part }
      : role === "DEPARTMENT_HEAD" ? { role, department }
      : role === "DEPARTMENT_MEMBER" ? { role, department, unit } : { role };
    void run(() => assignMemberRole(item.id, input), "직책을 추가하지 못했습니다.");
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => updateMemberProfile(item.id, { part: profilePart || null, cohort: cohort.trim() ? Number(cohort) : null }),
      "파트와 기수를 저장하지 못했습니다.");
  }

  if (!can(session, "MANAGE_ROLES")) {
    return <p className={styles.roleList}>
      {item.part && <span>{partLabel[item.part]}</span>}{item.cohort !== null && <span>{item.cohort}기</span>}
      {item.roles.map((assigned) => <StatusBadge key={assigned.id} tone="positive">{describeRole(assigned)}</StatusBadge>)}
      {item.admin && <StatusBadge tone="neutral">사이트 관리자</StatusBadge>}
    </p>;
  }

  return <div className={styles.roles}>
    <form className={styles.inlineForm} onSubmit={saveProfile}>
      <label htmlFor={`part-${item.id}`}>파트</label>
      <Select id={`part-${item.id}`} value={profilePart} onChange={(event) => setProfilePart(event.target.value as Part | "")}>
        <option value="">미지정</option>{parts.map((value) => <option key={value} value={value}>{partLabel[value]}</option>)}
      </Select>
      <label htmlFor={`cohort-${item.id}`}>기수</label>
      <Input id={`cohort-${item.id}`} type="number" min={1} value={cohort} onChange={(event) => setCohort(event.target.value)} />
      <Button variant="secondary" size="small" type="submit" disabled={busy}>파트·기수 저장</Button>
    </form>
    <p className={styles.roleList}>
      {item.roles.length === 0 && <span>직책 없음</span>}
      {item.roles.map((assigned) => <span key={assigned.id} className={styles.roleChip}>{describeRole(assigned)}
        {(leadership || (assigned.role !== "PRESIDENT" && assigned.role !== "VICE_PRESIDENT")) && <Button variant="unstyled" type="button" disabled={busy}
          aria-label={`${describeRole(assigned)} 해제`} onClick={() => void run(() => removeMemberRole(item.id, assigned.id), "직책을 해제하지 못했습니다.")}>×</Button>}
      </span>)}
      {item.admin && <StatusBadge tone="neutral">사이트 관리자</StatusBadge>}
    </p>
    {eligible && <form className={styles.inlineForm} onSubmit={add}>
      <label htmlFor={`role-${item.id}`}>추가할 직책</label>
      <Select id={`role-${item.id}`} value={role} onChange={(event) => setRole(event.target.value as Role)}>
        {choices.map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
      </Select>
      {(role === "DEPARTMENT_HEAD" || role === "DEPARTMENT_MEMBER") && <>
        <label htmlFor={`department-${item.id}`}>부서</label>
        <Select id={`department-${item.id}`} value={department} onChange={(event) => { const next = event.target.value as Department; setDepartment(next); setUnit(unitsOf[next][0]); }}>
          {departments.map((value) => <option key={value} value={value}>{departmentLabel[value]}</option>)}
        </Select>
      </>}
      {role === "DEPARTMENT_MEMBER" && <>
        <label htmlFor={`unit-${item.id}`}>계</label>
        <Select id={`unit-${item.id}`} value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>
          {unitsOf[department].map((value) => <option key={value} value={value}>{unitLabel[value]}</option>)}
        </Select>
      </>}
      {role === "SECTION_LEAD" && <>
        <label htmlFor={`lead-part-${item.id}`}>파트</label>
        <Select id={`lead-part-${item.id}`} value={part} onChange={(event) => setPart(event.target.value as Part)}>
          {parts.map((value) => <option key={value} value={value}>{partLabel[value]}</option>)}
        </Select>
      </>}
      <Button variant="secondary" size="small" type="submit" disabled={busy}>직책 추가</Button>
    </form>}
    {leadership && eligible && item.id !== session.id && <Button variant={item.admin ? "danger" : "secondary"} size="small" type="button" disabled={busy}
      onClick={() => void run(() => setSiteAdmin(item.id, !item.admin), "사이트 관리자 권한을 바꾸지 못했습니다.")}>
      {item.admin ? "사이트 관리자 해제" : "사이트 관리자 지정"}</Button>}
    {error && <Feedback tone="error">{error}</Feedback>}
  </div>;
}
```
`roles.ts`에서 `parts`, `roles`, `departments`, `unitsOf` 이름을 그대로 쓴다(Task 5 Step 2).

`AdminPages.module.css` 끝에 추가:
```css
.roles { display: grid; gap: var(--space-3); margin-top: var(--space-3); }
.inlineForm { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.inlineForm label { font-size: var(--text-small); font-weight: var(--weight-label); }
.inlineForm select, .inlineForm input { width: auto; min-width: 120px; }
.roleList { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: 0; color: var(--color-muted); font-size: var(--text-label); }
.roleChip { display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); border-radius: var(--radius-small); background: var(--color-selected); color: var(--color-primary); font-weight: var(--weight-label); }
.roleChip button { color: var(--color-primary); font-size: var(--text-body); line-height: 1; }
```
`ui.module.css`의 `.control`은 `width: 100%`라서 `.inlineForm select, .inlineForm input`로 폭을 줄인다. 선택자 특이도는 `.inlineForm select`(0,1,1)가 `.control`(0,1,0)보다 높다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd web && npx vitest run src/features/member/MemberRoles.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: MemberAccountManager에 끼워 넣고 권한으로 가린다**

`web/src/features/member/MemberAccountManager.tsx`:
- `useState<number | null>(null)`인 `currentMemberId` 대신 세션 전체를 둔다: `const [session, setSession] = useState<MemberSession | null>(null);` 그리고 효과 안 `getSession().then((session) => { if (!session.admin || session.status !== "APPROVED") throw new Error("ADMIN_REQUIRED"); ...`를 `if (!can(session, "VIEW_MEMBERS") || session.status !== "APPROVED") throw new Error("PERMISSION_REQUIRED"); if (alive) setSession(session);`로 바꾼다. `MemberSession`, `can`을 `../auth/session`에서 import한다.
- `MemberRow`에 `session: MemberSession`과 `onChanged: () => void`를 넘기고(`currentMemberId` 대신), 행 안 `<p>{item.email} · ...</p>` 바로 아래에 `<MemberRoles item={item} session={session} onChanged={onChanged} />`를 넣는다. `onChanged`는 `() => setRefresh((value) => value + 1)`이다.
- 행의 "· 운영진" 표기는 `MemberRoles`가 "사이트 관리자" 배지로 보여 주므로 지운다.
- 접근 해제 영역은 `can(session, "REVOKE_ACCESS")`일 때만, 초대 링크 다시 발급·다시 초대 버튼은 `can(session, "APPROVE_APPLICATIONS")`일 때만 보여 준다.
- `<MemberRegistration>`과 그 안의 1회용 링크 접힘 영역은 `can(session, "MANAGE_ALLOWLIST") || can(session, "APPROVE_APPLICATIONS")`일 때만 그린다. `MemberRegistration`에 `session` prop을 넘긴다.
- 발급된 링크 카드는 그대로 둔다.
- 데이터를 세션보다 먼저 그리지 않도록 목록은 `session && data`일 때 그린다.

`web/src/features/member/MemberRegistration.tsx`:
- props를 `{ session: MemberSession; children?: ReactNode }`로 바꾼다.
- 등록 폼은 `can(session, "MANAGE_ALLOWLIST")`일 때만, 운영진 등록 목록(`PendingList admin`)과 체크박스는 `can(session, "MANAGE_SITE_ADMINS")`일 때만 그린다.
- 체크박스 문구를 "운영진 권한도 부여"에서 "사이트 관리자 권한도 부여"로 바꾸고, 안내문을 "등록한 이메일의 구글 계정으로 로그인하면 바로 승인됩니다. 사이트 관리자 권한은 사이트 관리자만 줄 수 있습니다."로 바꾼다. 목록 항목의 " · 운영진"은 " · 사이트 관리자"로 바꾼다.
- 1회용 링크 접힘 영역(`children`)은 `can(session, "APPROVE_APPLICATIONS")`일 때만 그린다.

`MemberRegistration.test.tsx`: `render(<MemberRegistration />)` 세 곳을 `render(<MemberRegistration session={{ id: 1, name: "관리자", status: "APPROVED", memberType: "ACTIVE", admin: true }} />)`로, `"운영진 권한도 부여"`를 `"사이트 관리자 권한도 부여"`로 바꾼다.
`MemberAccountManager.test.tsx`: `getMembers` 목업 항목이 있다면 `part: null, cohort: null, roles: []`를 더한다(현재는 빈 목록이라 변경 없음).

- [ ] **Step 7: 테스트·린트·타입 검사**

Run: `cd web && npx vitest run src/features/member && npx eslint src/features/member && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add web/src/features/member
git commit -m "feat: 단원 계정 화면에서 파트·기수·직책과 사이트 관리자 지정

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 나머지 화면의 권한 검사 교체와 마무리

**Files:**
- Modify: `web/src/features/event/EventEditor.tsx:55`
- Modify: `web/src/features/notice/NoticeEditor.tsx:40`
- Modify: `web/src/features/attendance/AdminAttendancePanel.tsx:37`
- Modify: `web/src/features/member/ApplicationQueue.tsx:24`
- Modify: `web/src/features/event/EventPage.tsx:79`
- Modify: `docs/operations.md`
- Modify: `docs/design-system.md` (단원 계정 화면 기록에 직책 편집 한 줄)

**Interfaces:**
- Consumes: Task 5의 `can`.

- [ ] **Step 1: session.admin 검사를 권한으로 바꾼다**

- `EventEditor.tsx:55` `if (member.status !== "APPROVED" || !member.admin)` → `if (member.status !== "APPROVED" || !can(member, "MANAGE_EVENTS"))`
- `NoticeEditor.tsx:40` `if (!session.admin || session.status !== "APPROVED")` → `if (!can(session, "MANAGE_EVENTS") || session.status !== "APPROVED")`
- `AdminAttendancePanel.tsx:37` `if (!member.admin) throw ...` → `if (!can(member, "MANAGE_EVENTS")) throw ...`
- `ApplicationQueue.tsx:24` `if (!session.admin || session.status !== "APPROVED")` → `if (!can(session, "APPROVE_APPLICATIONS") || session.status !== "APPROVED")`
- `EventPage.tsx:79` `{session.admin && <p>...운영진 출석 관리...}` → `{can(session, "MANAGE_EVENTS") && <p>...}`
- 각 파일 import에 `can`을 추가한다. 기존 테스트의 세션 목업은 `admin: true`라서 `can`이 참을 돌려주므로 그대로 통과해야 한다.

`grep -rn "\.admin\b" web/src/features --include=*.tsx | grep -v test | grep -v "item.admin"`이 아무것도 찾지 않아야 한다.

- [ ] **Step 2: 전체 테스트·린트·빌드**

Run: `cd web && npx vitest run && npx eslint && npx next build`
Expected: 테스트 전부 PASS, 린트 오류 0, 빌드 성공

- [ ] **Step 3: 운영 문서를 갱신한다**

`docs/operations.md`의 첫 운영진 절차(5번 항목) 뒤에 단락을 추가한다:
```markdown
7. 직책은 `/admin/members`에서 사이트 관리자나 단장이 회원 행마다 부여합니다. 단장·부단장 지정과 사이트 관리자 지정은 사이트 관리자만 합니다. 직책은 승인된 활동 단원에게만 줄 수 있고, 접근을 해제하면 직책이 모두 지워집니다. 기존 `admin` 계정은 배포 뒤 그대로 사이트 관리자이며, 직책은 비어 있으므로 안내문에 맞춰 직접 부여합니다. 권한은 요청마다 다시 계산하므로 직책을 바꾼 뒤 다시 로그인할 필요가 없습니다.
```
`docs/design-system.md`의 "단원 계정 화면 재구성 (2026-10-02)" 아래에 한 줄 추가:
```markdown
- 2026-10-03: 회원 행마다 파트·기수와 직책을 편집한다. 직책은 초록 칩으로, 사이트 관리자는 회색 배지로 표시한다. 등록 폼의 "사이트 관리자 권한도 부여"는 사이트 관리자에게만 보인다.
```

- [ ] **Step 4: 목업으로 화면을 확인한다**

스크래치패드의 목업 API(`mock.mjs`)에서 `/auth/me` 응답에 `part: "SOPRANO", cohort: 1, roles: [{ id: 1, role: "PRESIDENT", department: null, unit: null, part: null }], permissions: [...]`를 더하고, `/admin/members` 항목에 `part`, `cohort`, `roles`를 더한 뒤, 사이트 관리자(`admin: true`)·단장(`admin: false`, 단장 권한)·수석(수석 권한) 세 경우로 `/admin/members`와 `/admin/events`를 1440px와 390px에서 캡처한다. 수석에게 "가입 승인" 메뉴와 접근 해제 버튼이 보이지 않는지, 단장에게 부단장 선택지와 사이트 관리자 버튼이 없는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add web/src/features docs/operations.md docs/design-system.md
git commit -m "feat: 운영진 화면의 접근 검사를 권한 목록으로 교체

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## 배포 뒤 할 일

- Render의 API가 Flyway `V5`를 적용하는지 로그에서 확인한다. 기존 `admin` 계정으로 로그인해 `/admin/members`에서 직책을 부여한다.
- ②단계(행사 종류·파트연습)와 ③단계(회의록)는 각각 별도 계획으로 쓴다. ②단계는 `Permission.MANAGE_FULL_REHEARSALS`, `MANAGE_PART_REHEARSALS`와 수석의 파트(`MemberRole.part`)를 쓰고, ③단계는 `WRITE_MINUTES`, `DELETE_MINUTES`, `VIEW_MINUTES`를 쓴다.
