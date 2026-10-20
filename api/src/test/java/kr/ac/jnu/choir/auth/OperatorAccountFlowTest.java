package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import kr.ac.jnu.choir.auth.GoogleIdentityVerifier.GoogleIdentity;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import kr.ac.jnu.choir.member.MemberType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@Testcontainers
class OperatorAccountFlowTest {
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
    @Autowired ObjectMapper mapper;
    @MockitoBean GoogleIdentityVerifier google;
    MockMvc mvc;

    @BeforeEach void setup() { mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build(); }

    @Test void verifiedGmailConnectsOnlyBootstrapInvitedAdminWithoutLink() throws Exception {
        String email = "first-admin-" + UUID.randomUUID() + "@gmail.com";
        String subject = "subject-" + UUID.randomUUID();
        Member invited = members.save(Member.invited(email, "첫 운영진", MemberType.ACTIVE, Clock.systemUTC()));
        jdbc.update("UPDATE member SET admin = TRUE WHERE id = ?", invited.getId());
        jdbc.update("""
                INSERT INTO admin_action_log
                    (actor_member_id, target_member_id, action, previous_status, new_status, reason, acted_at)
                VALUES (?, ?, 'BOOTSTRAP_INVITE', 'INVITED', 'INVITED', '최초 운영진 초대', ?)
                """, invited.getId(), invited.getId(), Timestamp.from(Instant.now()));
        jdbc.update("""
                INSERT INTO auth_token (member_id, purpose, token_hash, expires_at, created_at)
                VALUES (?, 'ACCOUNT_SETUP', ?, ?, ?)
                """, invited.getId(), "0".repeat(64), Timestamp.from(Instant.now().plusSeconds(3600)),
                Timestamp.from(Instant.now()));

        MockHttpSession loginSession = new MockHttpSession();
        assertThat(login(loginSession, "bootstrap-credential", subject, email, "첫 운영진", true))
                .contains("\"status\":\"APPROVED\"")
                .contains("\"admin\":true");
        Member linked = members.findById(invited.getId()).orElseThrow();
        assertThat(linked.getGoogleSubject()).isEqualTo(subject);
        assertThat(linked.isAdmin()).isTrue();
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM auth_token WHERE member_id = ? AND used_at IS NULL
                """, Integer.class, invited.getId())).isZero();
        assertThat(mvc.perform(get("/api/v1/admin/members").session(loginSession))
                .andReturn().getResponse().getStatus()).isEqualTo(200);

        String otherEmail = "other-admin-" + UUID.randomUUID() + "@gmail.com";
        Member other = members.save(Member.invited(otherEmail, "다른 운영진", MemberType.ACTIVE, Clock.systemUTC()));
        jdbc.update("UPDATE member SET admin = TRUE WHERE id = ?", other.getId());
        MockHttpSession otherSession = new MockHttpSession();
        String credential = "other-admin-credential";
        when(google.verify(credential)).thenReturn(new GoogleIdentity("subject-" + UUID.randomUUID(),
                otherEmail, "다른 운영진", true, nonce(otherSession)));
        var response = mvc.perform(post("/api/v1/auth/google").session(otherSession)
                .header("X-CSRF-TOKEN", csrf(otherSession)).contentType("application/json")
                .content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(409);
        assertThat(response.getContentAsString()).contains("ACCOUNT_LINK_REQUIRED");
    }

    @Test void invitationConnectsGoogleOnceAndRevocationBlocksLogin() throws Exception {
        int attemptsBeforeConnection = attempts("CONNECT_IP");
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String adminCsrf = csrf(adminSession);
        String email = "invited-" + UUID.randomUUID() + "@example.org";
        String response = mvc.perform(post("/api/v1/admin/members/invitations").session(adminSession)
                .header("X-CSRF-TOKEN", adminCsrf).contentType("application/json")
                .content("{\"name\":\"단원\",\"email\":\"" + email + "\",\"memberType\":\"ACTIVE\"}"))
                .andReturn().getResponse().getContentAsString();
        long memberId = mapper.readTree(response).get("memberId").asLong();
        String token = mapper.readTree(response).get("token").asText();
        assertThat(members.findById(memberId).orElseThrow().getStatus()).isEqualTo(AccountStatus.INVITED);
        String subject = "subject-" + UUID.randomUUID();

        MockHttpSession memberSession = new MockHttpSession();
        String memberCsrf = csrf(memberSession);
        when(google.verify("invited-credential")).thenReturn(new GoogleIdentity(subject,
                email, "단원", false, nonce(memberSession)));
        assertThat(mvc.perform(post("/api/v1/auth/account-setup/confirm").session(memberSession)
                .header("X-CSRF-TOKEN", memberCsrf).contentType("application/json")
                .content("{\"token\":\"" + token + "\",\"credential\":\"invited-credential\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(attempts("CONNECT_IP")).isEqualTo(attemptsBeforeConnection);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(memberSession))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        when(google.verify("invited-credential")).thenReturn(new GoogleIdentity(subject,
                email, "단원", false, nonce(memberSession)));
        assertThat(mvc.perform(post("/api/v1/auth/account-setup/confirm").session(memberSession)
                .header("X-CSRF-TOKEN", memberCsrf).contentType("application/json")
                .content("{\"token\":\"" + token + "\",\"credential\":\"invited-credential\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(409);
        assertThat(members.findById(memberId).orElseThrow().getGoogleSubject()).isNotBlank();

        String revocation = mvc.perform(post("/api/v1/admin/members/" + memberId + "/revoke")
                .session(adminSession).header("X-CSRF-TOKEN", adminCsrf).contentType("application/json")
                .content("{\"reason\":\"명단 변경\"}")).andReturn().getResponse().getContentAsString();
        assertThat(revocation).isEmpty();
        assertThat(mvc.perform(get("/api/v1/auth/me").session(memberSession))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        MockHttpSession retry = new MockHttpSession();
        when(google.verify("invited-credential")).thenReturn(new GoogleIdentity(subject,
                email, "단원", false, nonce(retry)));
        assertThat(mvc.perform(post("/api/v1/auth/google").session(retry)
                .header("X-CSRF-TOKEN", csrf(retry)).contentType("application/json")
                .content("{\"credential\":\"invited-credential\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    @Test void allowlistAutoApprovesGmailAndExternalEmailWaitsForAdmin() throws Exception {
        int attemptsBeforeLogin = attempts("GOOGLE_IP");
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String adminCsrf = csrf(adminSession);
        String gmail = "member" + UUID.randomUUID().toString().replace("-", "") + "@gmail.com";
        String external = "member-" + UUID.randomUUID() + "@example.org";
        long gmailEntry = addAllowlist(adminSession, adminCsrf, gmail);
        addAllowlist(adminSession, adminCsrf, external);
        String gmailSubject = "sub-" + UUID.randomUUID();
        String externalSubject = "sub-" + UUID.randomUUID();

        MockHttpSession gmailSession = new MockHttpSession();
        assertThat(login(gmailSession, "gmail-credential", gmailSubject, gmail, "자동 승인", true))
                .contains("\"status\":\"APPROVED\"");
        assertThat(attempts("GOOGLE_IP")).isEqualTo(attemptsBeforeLogin);
        assertThat(members.findByEmailIgnoreCase(gmail).orElseThrow().getMemberType().name()).isEqualTo("ACTIVE");
        assertThat(members.findByEmailIgnoreCase(gmail).orElseThrow().getName()).isEqualTo("자동 승인");
        MockHttpSession externalSession = new MockHttpSession();
        assertThat(login(externalSession, "external-credential", externalSubject, external, "승인 대기", false))
                .contains("\"status\":\"APPROVAL_PENDING\"");
        assertThat(mvc.perform(get("/api/v1/auth/me").session(externalSession))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        var forbidden = mvc.perform(get("/api/v1/events").session(externalSession)).andReturn().getResponse();
        assertThat(forbidden.getStatus()).isEqualTo(403);
        assertThat(forbidden.getContentAsString()).contains("APPROVAL_REQUIRED");

        long targetId = members.findByEmailIgnoreCase(external).orElseThrow().getId();
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + targetId + "/approve")
                .session(adminSession).header("X-CSRF-TOKEN", adminCsrf).contentType("application/json")
                .content("{\"memberType\":\"OB\"}")).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(members.findById(targetId).orElseThrow().getMemberType().name()).isEqualTo("OB");
        assertThat(mvc.perform(get("/api/v1/auth/me").session(externalSession))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        MockHttpSession approvedSession = new MockHttpSession();
        assertThat(login(approvedSession, "external-credential", externalSubject, external, "승인 대기", false))
                .contains("\"status\":\"APPROVED\"");

        String pending = mvc.perform(get("/api/v1/admin/allowlist").session(adminSession))
                .andReturn().getResponse().getContentAsString();
        assertThat(pending).doesNotContain(gmail);
        assertThat(mvc.perform(delete("/api/v1/admin/allowlist/" + gmailEntry)
                .session(adminSession).header("X-CSRF-TOKEN", adminCsrf))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_action_log a JOIN member m ON m.id = a.target_member_id "
                + "WHERE m.email = ? AND a.action = 'ALLOWLIST_APPROVE'", Integer.class, gmail)).isEqualTo(1);
        assertThat(members.findByEmailIgnoreCase(gmail).orElseThrow().getStatus()).isEqualTo(AccountStatus.APPROVED);
    }

    @Test void cancelledRejectionLetsAllowlistApproveOnNextLogin() throws Exception {
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String adminCsrf = csrf(adminSession);
        String gmail = "rejected" + UUID.randomUUID().toString().replace("-", "") + "@gmail.com";
        String subject = "sub-" + UUID.randomUUID();
        assertThat(login(new MockHttpSession(), "rejected-credential", subject, gmail, "모르는 이름", true))
                .contains("\"status\":\"APPROVAL_PENDING\"");
        long id = members.findByEmailIgnoreCase(gmail).orElseThrow().getId();
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + id + "/reject").session(adminSession)
                .header("X-CSRF-TOKEN", adminCsrf).contentType("application/json")
                .content("{\"reason\":\"명단에 없음\"}")).andReturn().getResponse().getStatus()).isEqualTo(204);
        addAllowlist(adminSession, adminCsrf, gmail, "실제 단원");
        assertThat(login(new MockHttpSession(), "rejected-credential", subject, gmail, "모르는 이름", true))
                .contains("\"status\":\"REJECTED\"");

        assertThat(mvc.perform(post("/api/v1/admin/applications/" + id + "/cancel-rejection").session(adminSession)
                .header("X-CSRF-TOKEN", adminCsrf)).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(login(new MockHttpSession(), "rejected-credential", subject, gmail, "모르는 이름", true))
                .contains("\"status\":\"APPROVED\"");
        Member approved = members.findById(id).orElseThrow();
        assertThat(approved.getName()).isEqualTo("실제 단원");
        assertThat(approved.getStatus()).isEqualTo(AccountStatus.APPROVED);
    }

    @Test void preapprovedOperatorGetsAdminOnFirstVerifiedGoogleLogin() throws Exception {
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String csrf = csrf(adminSession);
        String email = "chair-" + UUID.randomUUID() + "@gmail.com";
        String body = mvc.perform(post("/api/v1/admin/operator-preapprovals").session(adminSession)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"memberType\":\"ACTIVE\"}"))
                .andReturn().getResponse().getContentAsString();
        long entryId = mapper.readTree(body).get("id").asLong();
        assertThat(members.findByEmailIgnoreCase(email)).isEmpty();

        MockHttpSession chairSession = new MockHttpSession();
        String subject = "subject-" + UUID.randomUUID();
        assertThat(login(chairSession, "chair-credential", subject, email, "회장", true))
                .contains("\"status\":\"APPROVED\"")
                .contains("\"admin\":true");
        Member chair = members.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(chair.getGoogleSubject()).isEqualTo(subject);
        assertThat(chair.getMemberType()).isEqualTo(MemberType.ACTIVE);
        assertThat(chair.isAdmin()).isTrue();
        assertThat(mvc.perform(get("/api/v1/admin/members").session(chairSession))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM admin_action_log
                WHERE target_member_id = ? AND action = 'OPERATOR_PREAPPROVAL'
                """, Integer.class, chair.getId())).isEqualTo(1);
        assertThat(mvc.perform(get("/api/v1/admin/operator-preapprovals").session(adminSession))
                .andReturn().getResponse().getContentAsString()).doesNotContain(email);
        assertThat(mvc.perform(delete("/api/v1/admin/operator-preapprovals/" + entryId)
                .session(adminSession).header("X-CSRF-TOKEN", csrf))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(members.findById(chair.getId()).orElseThrow().isAdmin()).isTrue();
        assertThat(mvc.perform(post("/api/v1/admin/members/" + chair.getId() + "/revoke")
                .session(adminSession).header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"reason\":\"운영진 명단 변경\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        MockHttpSession revokedSession = new MockHttpSession();
        assertThat(loginStatus(revokedSession, "chair-credential", subject, email, "회장", true)).isEqualTo(403);
        assertThat(members.findById(chair.getId()).orElseThrow().isAdmin()).isFalse();
    }

    @Test void preapprovalRequiresAdminAndAuthoritativeEmail() throws Exception {
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String csrf = csrf(adminSession);
        String email = "outside-" + UUID.randomUUID() + "@example.org";
        String requestBody = "{\"email\":\"" + email + "\",\"memberType\":\"OB\"}";
        MockHttpSession stranger = new MockHttpSession();
        assertThat(mvc.perform(post("/api/v1/admin/operator-preapprovals").session(stranger)
                .header("X-CSRF-TOKEN", csrf(stranger)).contentType("application/json")
                .content(requestBody)).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(post("/api/v1/admin/operator-preapprovals").session(adminSession)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content(requestBody)).andReturn().getResponse().getStatus()).isEqualTo(200);
        MockHttpSession memberSession = new MockHttpSession();
        String subject = "subject-" + UUID.randomUUID();
        assertThat(login(memberSession, "outside-credential", subject, email, "외부 계정", false))
                .contains("\"status\":\"APPROVAL_PENDING\"")
                .contains("\"admin\":false");
        assertThat(mvc.perform(get("/api/v1/admin/members").session(memberSession))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        MockHttpSession retry = new MockHttpSession();
        assertThat(login(retry, "outside-credential", subject, email, "외부 계정", false))
                .contains("\"status\":\"APPROVAL_PENDING\"");
        assertThat(members.findByEmailIgnoreCase(email).orElseThrow().isAdmin()).isFalse();
    }

    @Test void deletedPreapprovalDoesNotGrantAdminAndOrdinaryAllowlistStaysNonAdmin() throws Exception {
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String csrf = csrf(adminSession);
        String email = "member-" + UUID.randomUUID() + "@gmail.com";
        String body = mvc.perform(post("/api/v1/admin/operator-preapprovals").session(adminSession)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"memberType\":\"ACTIVE\"}"))
                .andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(body).get("id").asLong();
        assertThat(mvc.perform(delete("/api/v1/admin/operator-preapprovals/" + id)
                .session(adminSession).header("X-CSRF-TOKEN", csrf))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        addAllowlist(adminSession, csrf, email);
        MockHttpSession memberSession = new MockHttpSession();
        assertThat(login(memberSession, "ordinary-credential", "subject-" + UUID.randomUUID(),
                email, "단원", true))
                .contains("\"status\":\"APPROVED\"")
                .contains("\"admin\":false");
    }

    @Test void allowlistNameReplacesGoogleProfileNameOnApproval() throws Exception {
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String adminCsrf = csrf(adminSession);
        String gmail = "named" + UUID.randomUUID().toString().replace("-", "") + "@gmail.com";
        addAllowlist(adminSession, adminCsrf, gmail, "홍길동");
        assertThat(login(new MockHttpSession(), "named-credential", "sub-" + UUID.randomUUID(), gmail, "Jae", true))
                .contains("\"status\":\"APPROVED\"").contains("\"name\":\"홍길동\"");
        assertThat(members.findByEmailIgnoreCase(gmail).orElseThrow().getName()).isEqualTo("홍길동");
    }

    private long addAllowlist(MockHttpSession session, String csrf, String email) throws Exception {
        return addAllowlist(session, csrf, email, null);
    }

    private long addAllowlist(MockHttpSession session, String csrf, String email, String name) throws Exception {
        String body = mvc.perform(post("/api/v1/admin/allowlist").session(session)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"memberType\":\"ACTIVE\""
                        + (name == null ? "" : ",\"name\":\"" + name + "\"") + "}"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("id").asLong();
    }

    private int attempts(String kind) {
        return jdbc.queryForObject("SELECT COALESCE(SUM(attempt_count), 0) FROM auth_attempt WHERE kind = ?",
                Integer.class, kind);
    }

    private String login(MockHttpSession session, String credential, String subject, String email,
            String name, boolean authoritative) throws Exception {
        when(google.verify(credential)).thenReturn(new GoogleIdentity(subject, email, name, authoritative, nonce(session)));
        return mvc.perform(post("/api/v1/auth/google").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json")
                .content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse().getContentAsString();
    }

    private int loginStatus(MockHttpSession session, String credential, String subject, String email,
            String name, boolean authoritative) throws Exception {
        when(google.verify(credential)).thenReturn(new GoogleIdentity(subject, email, name, authoritative, nonce(session)));
        return mvc.perform(post("/api/v1/auth/google").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json")
                .content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    private Member admin() {
        Member member = members.save(new Member("operator-" + UUID.randomUUID() + "@example.org", "운영진",
                null, Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', admin = TRUE WHERE id = ?", member.getId());
        return member;
    }

    private MockHttpSession sessionFor(Member member) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return session;
    }

    private String csrf(MockHttpSession session) throws Exception {
        String response = mvc.perform(get("/api/v1/auth/csrf").session(session))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("token").asText();
    }

    private String nonce(MockHttpSession session) throws Exception {
        String response = mvc.perform(get("/api/v1/auth/google/nonce").session(session))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("nonce").asText();
    }
}
