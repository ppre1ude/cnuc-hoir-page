package kr.ac.jnu.choir.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Clock;
import kr.ac.jnu.choir.auth.MailSender;
import kr.ac.jnu.choir.common.AdminActionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
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
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest
@Testcontainers
@Import(MemberApprovalTest.MailConfiguration.class)
class MemberApprovalTest {
    @TestConfiguration
    static class MailConfiguration {
        @Bean @Primary MailSender testMailSender() {
            return new MailSender() {
                public void sendVerification(String address, String link) {}
                public void sendPasswordReset(String address, String link) {}
            };
        }
    }
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
        registry.add("choir.mail.enabled", () -> "false");
    }
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MemberRepository members;
    @Autowired AdminActionLogRepository logs;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;

    @BeforeEach void setup() { mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build(); }

    private Member member(String status, boolean admin) {
        Member member = members.save(new Member("approval-" + java.util.UUID.randomUUID() + "@example.org",
                "신청자", "{noop}correct-horse-battery", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = ?, admin = ?, email_verified_at = CASE WHEN ? = 'EMAIL_PENDING' THEN NULL ELSE CURRENT_TIMESTAMP(6) END WHERE id = ?",
                status, admin, status, member.getId());
        return members.findById(member.getId()).orElseThrow();
    }

    private MockHttpSession session(Member member) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return session;
    }

    @Test void onlyAdminsCanListAndChangeApplications() throws Exception {
        Member normal = member("APPROVED", false);
        Member applicant = member("APPROVAL_PENDING", false);
        assertThat(mvc.perform(get("/api/v1/admin/applications").session(session(normal)))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + applicant.getId() + "/approve")
                .session(session(normal)).contentType("application/json").content("{\"memberType\":\"OB\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    @Test void approvalRequiresVerifiedPendingAccountAndRecordsActor() throws Exception {
        Member admin = member("APPROVED", true);
        Member unverified = member("EMAIL_PENDING", false);
        Member pending = member("APPROVAL_PENDING", false);
        var csrf = mvc.perform(get("/api/v1/auth/csrf").session(session(admin))).andReturn();
        MockHttpSession adminSession = (MockHttpSession) csrf.getRequest().getSession(false);
        String token = csrf.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        String applications = mvc.perform(get("/api/v1/admin/applications?status=APPROVAL_PENDING&page=0&size=20")
                .session(adminSession)).andReturn().getResponse().getContentAsString();
        assertThat(applications).contains(pending.getEmail()).doesNotContain(unverified.getEmail());
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + unverified.getId() + "/approve")
                .session(adminSession).header("X-CSRF-TOKEN", token).contentType("application/json")
                .content("{\"memberType\":\"ACTIVE\"}")).andReturn().getResponse().getStatus()).isEqualTo(409);
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + pending.getId() + "/approve")
                .session(adminSession).header("X-CSRF-TOKEN", token).contentType("application/json")
                .content("{\"memberType\":\"OB\"}")).andReturn().getResponse().getStatus()).isEqualTo(204);
        Member approved = members.findById(pending.getId()).orElseThrow();
        assertThat(approved.getStatus()).isEqualTo(AccountStatus.APPROVED);
        assertThat(approved.getMemberType()).isEqualTo(MemberType.OB);
        assertThat(approved.getAuthVersion()).isEqualTo(1);
        assertThat(logs.countByTargetMemberId(pending.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT actor_member_id FROM admin_action_log WHERE target_member_id = ?", Long.class,
                pending.getId())).isEqualTo(admin.getId());
        assertThat(jdbc.queryForObject("SELECT action FROM admin_action_log WHERE target_member_id = ?", String.class,
                pending.getId())).isEqualTo("APPROVE");
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + pending.getId() + "/approve")
                .session(adminSession).header("X-CSRF-TOKEN", token).contentType("application/json")
                .content("{\"memberType\":\"ACTIVE\"}")).andReturn().getResponse().getStatus()).isEqualTo(409);
    }

    @Test void rejectAndRevokeRecordReasonsAndInvalidateSession() throws Exception {
        Member admin = member("APPROVED", true);
        Member pending = member("APPROVAL_PENDING", false);
        Member active = member("APPROVED", false);
        MockHttpSession oldSession = session(active);
        var csrf = mvc.perform(get("/api/v1/auth/csrf").session(session(admin))).andReturn();
        MockHttpSession adminSession = (MockHttpSession) csrf.getRequest().getSession(false);
        String token = csrf.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + pending.getId() + "/reject")
                .session(adminSession).header("X-CSRF-TOKEN", token).contentType("application/json")
                .content("{\"reason\":\"명단 확인 불가\"}")).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(post("/api/v1/admin/members/" + active.getId() + "/revoke")
                .session(adminSession).header("X-CSRF-TOKEN", token).contentType("application/json")
                .content("{\"reason\":\"접근 해제 요청\"}")).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(members.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(AccountStatus.REJECTED);
        assertThat(members.findById(active.getId()).orElseThrow().getStatus()).isEqualTo(AccountStatus.REVOKED);
        assertThat(logs.countByTargetMemberId(pending.getId())).isEqualTo(1);
        assertThat(logs.countByTargetMemberId(active.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT reason FROM admin_action_log WHERE target_member_id = ?", String.class,
                pending.getId())).isEqualTo("명단 확인 불가");
        assertThat(jdbc.queryForObject("SELECT previous_status FROM admin_action_log WHERE target_member_id = ?", String.class,
                active.getId())).isEqualTo("APPROVED");
        assertThat(jdbc.queryForObject("SELECT new_status FROM admin_action_log WHERE target_member_id = ?", String.class,
                active.getId())).isEqualTo("REVOKED");
        assertThat(jdbc.queryForObject("SELECT acted_at IS NOT NULL FROM admin_action_log WHERE target_member_id = ?", Integer.class,
                active.getId())).isEqualTo(1);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(oldSession)).andReturn().getResponse().getStatus()).isEqualTo(401);
    }
}
