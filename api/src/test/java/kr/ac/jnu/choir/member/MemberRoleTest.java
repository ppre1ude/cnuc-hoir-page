package kr.ac.jnu.choir.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
        return mvc.perform(get("/api/v1/auth/me").session(session(member)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

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
        Member president = member("단장", false);
        grant(president, "PRESIDENT", null, null, null, admin);
        Member target = member("총무", false);
        grant(target, "TREASURER", null, null, null, admin);
        Caller byAdmin = caller(admin);
        assertThat(put(byAdmin, "/api/v1/admin/members/" + admin.getId() + "/site-admin", "{\"admin\":false}")).isEqualTo(409);
        assertThat(put(byAdmin, "/api/v1/admin/members/" + target.getId() + "/site-admin", "{\"admin\":true}")).isEqualTo(204);
        assertThat(me(target)).contains("\"admin\":true");
        assertThat(post(caller(president), "/api/v1/admin/members/" + target.getId() + "/revoke", "{\"reason\":\"활동 종료\"}")).isEqualTo(403);
        assertThat(put(byAdmin, "/api/v1/admin/members/" + target.getId() + "/site-admin", "{\"admin\":false}")).isEqualTo(204);
        assertThat(post(byAdmin, "/api/v1/admin/members/" + target.getId() + "/revoke", "{\"reason\":\"활동 종료\"}")).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM member_role WHERE member_id = ?", Long.class, target.getId())).isZero();
    }

    @Test void removeChecksPermissionPerRole() throws Exception {
        Member admin = member("관리자", true);
        Member president = member("단장", false);
        grant(president, "PRESIDENT", null, null, null, admin);
        Member target = member("단원", false);
        grant(target, "SECTION_LEAD", null, null, "TENOR", admin);
        grant(target, "VICE_PRESIDENT", null, null, null, admin);
        long leadId = jdbc.queryForObject("SELECT id FROM member_role WHERE member_id = ? AND role = 'SECTION_LEAD'", Long.class, target.getId());
        long viceId = jdbc.queryForObject("SELECT id FROM member_role WHERE member_id = ? AND role = 'VICE_PRESIDENT'", Long.class, target.getId());
        Caller byPresident = caller(president);
        String base = "/api/v1/admin/members/" + target.getId() + "/roles/";

        assertThat(delete(byPresident, base + viceId)).isEqualTo(403);
        assertThat(delete(byPresident, base + (viceId + 1000))).isEqualTo(404);
        assertThat(delete(byPresident, base + leadId)).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM member_role WHERE id = ?", Long.class, leadId)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM member_role WHERE id = ?", Long.class, viceId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_action_log WHERE target_member_id = ? AND action = 'ROLE_REMOVE'",
                Long.class, target.getId())).isEqualTo(1);
    }

    @Test void onlySiteAdminReissuesSiteAdminAccount() throws Exception {
        Member admin = member("관리자", true);
        Member vice = member("부단장", false);
        grant(vice, "VICE_PRESIDENT", null, null, null, admin);
        Member target = member("관리자 계정", true);
        String path = "/api/v1/admin/members/" + target.getId() + "/account-setup";

        assertThat(post(caller(vice), path, "")).isEqualTo(403);
        assertThat(post(caller(admin), path, "")).isEqualTo(200);
    }

    @Test void revokingLeadershipNeedsSiteAdmin() throws Exception {
        Member admin = member("관리자", true);
        Member president = member("단장", false);
        grant(president, "PRESIDENT", null, null, null, admin);
        Member vice = member("부단장", false);
        grant(vice, "VICE_PRESIDENT", null, null, null, admin);
        Member ordinary = member("단원", false);
        Caller byPresident = caller(president);

        assertThat(post(byPresident, "/api/v1/admin/members/" + vice.getId() + "/revoke", "{\"reason\":\"활동 종료\"}")).isEqualTo(403);
        assertThat(post(byPresident, "/api/v1/admin/members/" + ordinary.getId() + "/revoke", "{\"reason\":\"활동 종료\"}")).isEqualTo(204);
    }

    @Test void profileRejectsNonPositiveCohort() throws Exception {
        Member admin = member("관리자", true);
        Member target = member("단원", false);
        assertThat(put(caller(admin), "/api/v1/admin/members/" + target.getId() + "/profile", "{\"cohort\":0}")).isEqualTo(400);
    }

    @Test void switchingToObRemovesRolesKeepsSiteAdminAndRecordsChange() throws Exception {
        Member admin = member("관리자", true);
        Member target = member("졸업 단원", true);
        grant(target, "TREASURER", null, null, null, admin);
        grant(target, "SECTION_LEAD", null, null, "BASS", admin);

        assertThat(put(caller(admin), "/api/v1/admin/members/" + target.getId() + "/profile",
                "{\"part\":\"BASS\",\"cohort\":3,\"memberType\":\"OB\"}")).isEqualTo(204);
        assertThat(me(target)).contains("\"memberType\":\"OB\"").contains("\"roles\":[]").contains("\"admin\":true");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM member_role WHERE member_id = ?", Long.class, target.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT reason FROM admin_action_log WHERE target_member_id = ? AND action = 'PROFILE_UPDATE'",
                String.class, target.getId())).contains("구분 ACTIVE→OB").contains("TREASURER").contains("SECTION_LEAD");

        assertThat(put(caller(admin), "/api/v1/admin/members/" + target.getId() + "/profile",
                "{\"part\":\"BASS\",\"cohort\":3,\"memberType\":\"ACTIVE\"}")).isEqualTo(204);
        assertThat(me(target)).contains("\"memberType\":\"ACTIVE\"");
    }

    @Test void presidentCannotStripLeadershipBySwitchingToOb() throws Exception {
        Member admin = member("관리자", true);
        Member president = member("단장", false);
        grant(president, "PRESIDENT", null, null, null, admin);
        Member vice = member("부단장", false);
        grant(vice, "VICE_PRESIDENT", null, null, null, admin);

        assertThat(put(caller(president), "/api/v1/admin/members/" + vice.getId() + "/profile",
                "{\"memberType\":\"OB\"}")).isEqualTo(403);
        assertThat(me(vice)).contains("\"memberType\":\"ACTIVE\"").contains("\"role\":\"VICE_PRESIDENT\"");
    }

    @Test void memberTypeChangesOnlyForApprovedAccounts() throws Exception {
        Member admin = member("관리자", true);
        Member pending = member("신청자", false);
        jdbc.update("UPDATE member SET status = 'APPROVAL_PENDING', member_type = NULL WHERE id = ?", pending.getId());

        assertThat(put(caller(admin), "/api/v1/admin/members/" + pending.getId() + "/profile",
                "{\"memberType\":\"OB\"}")).isEqualTo(409);
        assertThat(put(caller(admin), "/api/v1/admin/members/" + pending.getId() + "/profile",
                "{\"cohort\":4}")).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT member_type IS NULL FROM member WHERE id = ?", Boolean.class, pending.getId())).isTrue();
    }

    @Test void memberListIncludesRoles() throws Exception {
        Member admin = member("관리자", true);
        Member lead = member("수석", false);
        grant(lead, "SECTION_LEAD", null, null, "SOPRANO", admin);
        String body = mvc.perform(get("/api/v1/admin/members?page=0&size=100").session(session(admin)))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).contains("\"role\":\"SECTION_LEAD\",\"department\":null,\"unit\":null,\"part\":\"SOPRANO\"");
    }

    @Test void memberListHidesEmailFromStaffWithoutManagementPermissions() throws Exception {
        Member admin = member("관리자", true);
        Member lead = member("수석", false);
        grant(lead, "SECTION_LEAD", null, null, "SOPRANO", admin);
        Member president = member("단장", false);
        grant(president, "PRESIDENT", null, null, null, admin);
        String path = "/api/v1/admin/members?page=0&size=100";

        String hidden = mvc.perform(get(path).session(session(lead))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String shown = mvc.perform(get(path).session(session(president))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(hidden).doesNotContain("@example.org").contains("\"googleLinked\":false");
        assertThat(shown).contains("@example.org");
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

    @Test void unapprovedAccountHasNoPermissions() throws Exception {
        Member admin = member("관리자", true);
        Member pending = member("단원", false);
        jdbc.update("UPDATE member SET status = 'APPROVAL_PENDING' WHERE id = ?", pending.getId());
        grant(pending, "TREASURER", null, null, null, admin);

        assertThat(me(pending)).contains("\"permissions\":[]");
    }
}
