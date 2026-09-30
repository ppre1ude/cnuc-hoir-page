package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Clock;
import java.util.UUID;
import kr.ac.jnu.choir.auth.GoogleIdentityVerifier.GoogleIdentity;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
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

    @Test void invitationConnectsGoogleOnceAndRevocationBlocksLogin() throws Exception {
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
        when(google.verify("invited-credential")).thenReturn(new GoogleIdentity("subject-" + UUID.randomUUID(),
                email, "단원", false));

        MockHttpSession memberSession = new MockHttpSession();
        String memberCsrf = csrf(memberSession);
        assertThat(mvc.perform(post("/api/v1/auth/account-setup/confirm").session(memberSession)
                .header("X-CSRF-TOKEN", memberCsrf).contentType("application/json")
                .content("{\"token\":\"" + token + "\",\"credential\":\"invited-credential\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(memberSession))
                .andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(post("/api/v1/auth/account-setup/confirm").session(new MockHttpSession())
                .contentType("application/json")
                .content("{\"token\":\"" + token + "\",\"credential\":\"invited-credential\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(members.findById(memberId).orElseThrow().getGoogleSubject()).isNotBlank();

        String revocation = mvc.perform(post("/api/v1/admin/members/" + memberId + "/revoke")
                .session(adminSession).header("X-CSRF-TOKEN", adminCsrf).contentType("application/json")
                .content("{\"reason\":\"명단 변경\"}")).andReturn().getResponse().getContentAsString();
        assertThat(revocation).isEmpty();
        assertThat(mvc.perform(get("/api/v1/auth/me").session(memberSession))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        MockHttpSession retry = new MockHttpSession();
        assertThat(mvc.perform(post("/api/v1/auth/google").session(retry)
                .header("X-CSRF-TOKEN", csrf(retry)).contentType("application/json")
                .content("{\"credential\":\"invited-credential\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    @Test void allowlistAutoApprovesGmailAndExternalEmailWaitsForAdmin() throws Exception {
        Member admin = admin();
        MockHttpSession adminSession = sessionFor(admin);
        String adminCsrf = csrf(adminSession);
        String gmail = "member" + UUID.randomUUID().toString().replace("-", "") + "@gmail.com";
        String external = "member-" + UUID.randomUUID() + "@example.org";
        long gmailEntry = addAllowlist(adminSession, adminCsrf, gmail);
        addAllowlist(adminSession, adminCsrf, external);
        when(google.verify("gmail-credential")).thenReturn(new GoogleIdentity("sub-" + UUID.randomUUID(),
                gmail, "자동 승인", true));
        when(google.verify("external-credential")).thenReturn(new GoogleIdentity("sub-" + UUID.randomUUID(),
                external, "승인 대기", false));

        MockHttpSession gmailSession = new MockHttpSession();
        assertThat(login(gmailSession, "gmail-credential")).contains("\"status\":\"APPROVED\"");
        assertThat(members.findByEmailIgnoreCase(gmail).orElseThrow().getMemberType().name()).isEqualTo("ACTIVE");
        MockHttpSession externalSession = new MockHttpSession();
        assertThat(login(externalSession, "external-credential")).contains("\"status\":\"APPROVAL_PENDING\"");
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
        assertThat(login(approvedSession, "external-credential")).contains("\"status\":\"APPROVED\"");

        assertThat(mvc.perform(delete("/api/v1/admin/allowlist/" + gmailEntry)
                .session(adminSession).header("X-CSRF-TOKEN", adminCsrf))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(members.findByEmailIgnoreCase(gmail).orElseThrow().getStatus()).isEqualTo(AccountStatus.APPROVED);
    }

    private long addAllowlist(MockHttpSession session, String csrf, String email) throws Exception {
        String body = mvc.perform(post("/api/v1/admin/allowlist").session(session)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"memberType\":\"ACTIVE\"}"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("id").asLong();
    }

    private String login(MockHttpSession session, String credential) throws Exception {
        return mvc.perform(post("/api/v1/auth/google").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json")
                .content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse().getContentAsString();
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
}
