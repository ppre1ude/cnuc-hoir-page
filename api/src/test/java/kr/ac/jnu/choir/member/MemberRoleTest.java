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
