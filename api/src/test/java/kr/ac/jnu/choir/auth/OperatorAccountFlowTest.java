package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.util.UUID;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

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
    MockMvc mvc;

    @BeforeEach void setup() { mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build(); }

    @Test void inviteActivateReissueAndInvalidateSessions() throws Exception {
        Member admin = members.save(new Member("operator-" + UUID.randomUUID() + "@example.org", "운영진",
                "{noop}correct-horse-battery", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', admin = TRUE WHERE id = ?", admin.getId());
        MockHttpSession adminSession = new MockHttpSession();
        adminSession.setAttribute("memberId", admin.getId());
        adminSession.setAttribute("authVersion", admin.getAuthVersion());
        String csrf = csrf(adminSession);

        assertThat(mvc.perform(post("/api/v1/admin/members/invitations")
                .contentType("application/json")
                .content("{\"name\":\"단원\",\"email\":\"member-" + UUID.randomUUID()
                        + "@example.org\",\"memberType\":\"ACTIVE\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);

        String response = mvc.perform(post("/api/v1/admin/members/invitations").session(adminSession)
                .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"name\":\"단원\",\"email\":\"member-" + UUID.randomUUID()
                        + "@example.org\",\"memberType\":\"ACTIVE\"}"))
                .andReturn().getResponse().getContentAsString();
        long memberId = mapper.readTree(response).get("memberId").asLong();
        String firstToken = mapper.readTree(response).get("token").asText();
        Member invited = members.findById(memberId).orElseThrow();
        assertThat(invited.getStatus()).isEqualTo(AccountStatus.INVITED);
        assertThat(invited.getPasswordHash()).isNull();
        assertThat(jdbc.queryForObject("SELECT token_hash FROM auth_token WHERE member_id = ?",
                String.class, memberId)).isNotEqualTo(firstToken);
        assertThat(mvc.perform(get("/api/v1/admin/members").session(adminSession))
                .andReturn().getResponse().getContentAsString()).contains(invited.getEmail());

        String secondToken = mapper.readTree(mvc.perform(post("/api/v1/admin/members/" + memberId + "/account-setup")
                .session(adminSession).header("X-CSRF-TOKEN", csrf)).andReturn()
                .getResponse().getContentAsString()).get("token").asText();
        assertThat(complete(firstToken, "new-correct-horse-battery")).isEqualTo(409);
        assertThat(complete(secondToken, "new-correct-horse-battery")).isEqualTo(204);
        assertThat(complete(secondToken, "new-correct-horse-battery")).isEqualTo(409);
        assertThat(members.findById(memberId).orElseThrow().getStatus()).isEqualTo(AccountStatus.APPROVED);

        MockHttpSession memberSession = new MockHttpSession();
        String loginCsrf = csrf(memberSession);
        assertThat(mvc.perform(post("/api/v1/auth/login").session(memberSession)
                .header("X-CSRF-TOKEN", loginCsrf).contentType("application/json")
                .content("{\"email\":\"" + invited.getEmail()
                        + "\",\"password\":\"new-correct-horse-battery\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(memberSession))
                .andReturn().getResponse().getStatus()).isEqualTo(200);

        String resetToken = mapper.readTree(mvc.perform(post("/api/v1/admin/members/" + memberId + "/account-setup")
                .session(adminSession).header("X-CSRF-TOKEN", csrf)).andReturn()
                .getResponse().getContentAsString()).get("token").asText();
        assertThat(complete(resetToken, "another-correct-horse-battery")).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(memberSession))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(post("/api/v1/admin/members/" + memberId + "/revoke")
                .session(adminSession).header("X-CSRF-TOKEN", csrf).contentType("application/json")
                .content("{\"reason\":\"명단 변경\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(members.findById(memberId).orElseThrow().getStatus()).isEqualTo(AccountStatus.REVOKED);
        String reinviteToken = mapper.readTree(mvc.perform(post("/api/v1/admin/members/" + memberId + "/account-setup")
                .session(adminSession).header("X-CSRF-TOKEN", csrf)).andReturn()
                .getResponse().getContentAsString()).get("token").asText();
        assertThat(members.findById(memberId).orElseThrow().getPasswordHash()).isNull();
        assertThat(complete(reinviteToken, "reinvited-correct-horse-battery")).isEqualTo(204);
        assertThat(members.findById(memberId).orElseThrow().getStatus()).isEqualTo(AccountStatus.APPROVED);
        assertThat(mvc.perform(post("/api/v1/auth/applications").session(new MockHttpSession())
                .contentType("application/json").content("{}"))
                .andReturn().getResponse().getStatus()).isNotEqualTo(202);
    }

    private int complete(String token, String password) throws Exception {
        MockHttpSession session = new MockHttpSession();
        return mvc.perform(post("/api/v1/auth/account-setup/confirm").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json")
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + password + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    private String csrf(MockHttpSession session) throws Exception {
        String response = mvc.perform(get("/api/v1/auth/csrf").session(session))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("token").asText();
    }
}
