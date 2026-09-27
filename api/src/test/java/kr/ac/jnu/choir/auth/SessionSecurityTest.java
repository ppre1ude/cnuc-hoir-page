package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
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
@Import(SessionSecurityTest.MemberProbe.class)
class SessionSecurityTest {
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
        registry.add("choir.mail.enabled", () -> "false");
        registry.add("choir.security.trusted-proxy-cidrs", () -> "10.0.0.0/8");
    }
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MemberRepository members;
    @Autowired JdbcTemplate jdbc;

    @RestController
    static class MemberProbe {
        @GetMapping("/api/v1/member/probe") String probe() { return "확인"; }
    }

    @TestConfiguration
    static class MailConfiguration {
        @Bean @Primary MailSender testMailSender() {
            return new MailSender() {
                public void sendVerification(String address, String link) {}
                public void sendPasswordReset(String address, String link) {}
            };
        }
    }

    @Test void loginAndAccess() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        assertThat(mvc.perform(get("/api/v1/auth/me")).andReturn().getResponse().getStatus()).isEqualTo(401);
        Member member = members.save(new Member("session@example.org", "단원",
                PasswordEncoderFactories.createDelegatingPasswordEncoder().encode("correct-horse-battery"), Clock.systemUTC()));
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String token = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        var login = mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", token)
                .contentType("application/json").content("{\"email\":\"session@example.org\",\"password\":\"correct-horse-battery\"}"))
                .andReturn();
        assertThat(login.getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(session)).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(get("/api/v1/member/private").session(session)).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(post("/api/v1/auth/logout").session(session)).andReturn().getResponse().getStatus()).isEqualTo(403);
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = 'ACTIVE' WHERE id = ?", member.getId());
        assertThat(mvc.perform(get("/api/v1/member/probe").session(session)).andReturn().getResponse().getStatus()).isEqualTo(200);
        jdbc.update("UPDATE member SET auth_version = auth_version + 1 WHERE id = ?", member.getId());
        assertThat(mvc.perform(get("/api/v1/auth/me").session(session)).andReturn().getResponse().getStatus()).isEqualTo(401);
        jdbc.update("UPDATE member SET status = 'REVOKED' WHERE id = ?", member.getId());
        var freshCsrf = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String freshToken = freshCsrf.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession freshSession = (MockHttpSession) freshCsrf.getRequest().getSession(false);
        assertThat(mvc.perform(post("/api/v1/auth/login").session(freshSession).header("X-CSRF-TOKEN", freshToken)
                .contentType("application/json")
                .content("{\"email\":\"session@example.org\",\"password\":\"correct-horse-battery\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test void limitsFailedLoginByEmailAndIp() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        for (int attempt = 0; attempt < 5; attempt++) {
            assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                    .remoteAddress("203.0.113.41").header("X-Forwarded-For", "198.51.100." + attempt)
                    .contentType("application/json")
                    .content("{\"email\":\"missing" + attempt + "@example.org\",\"password\":\"incorrect-password\"}"))
                    .andReturn().getResponse().getStatus()).isEqualTo(401);
        }
        assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                .remoteAddress("203.0.113.41").header("X-Forwarded-For", "198.51.100.99")
                .contentType("application/json")
                .content("{\"email\":\"missing-final@example.org\",\"password\":\"incorrect-password\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(429);
    }

    @Test void separateClientsBehindTrustedProxyHaveSeparateLimits() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        for (int attempt = 0; attempt < 5; attempt++) {
            assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                    .remoteAddress("10.0.0.8").header("X-Forwarded-For", "198.51.100.11")
                    .contentType("application/json")
                    .content("{\"email\":\"first" + attempt + "@example.org\",\"password\":\"incorrect-password\"}"))
                    .andReturn().getResponse().getStatus()).isEqualTo(401);
        }
        assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                .remoteAddress("10.0.0.8").header("X-Forwarded-For", "198.51.100.12")
                .contentType("application/json")
                .content("{\"email\":\"second@example.org\",\"password\":\"incorrect-password\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                .remoteAddress("10.0.0.8").header("X-Forwarded-For", "198.51.100.11")
                .contentType("application/json")
                .content("{\"email\":\"blocked@example.org\",\"password\":\"incorrect-password\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(429);
    }

    @Test void invalidTrustedProxyChainIsRejectedBeforeRateLimit() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        for (int attempt = 0; attempt < 6; attempt++) {
            assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                    .remoteAddress("10.0.0.9").header("X-Forwarded-For", "not-an-ip")
                    .contentType("application/json")
                    .content("{\"email\":\"invalid" + attempt + "@example.org\",\"password\":\"incorrect-password\"}"))
                    .andReturn().getResponse().getStatus()).isEqualTo(400);
        }
        assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                .remoteAddress("10.0.0.9").header("X-Forwarded-For", "198.51.100.31")
                .contentType("application/json")
                .content("{\"email\":\"valid-chain@example.org\",\"password\":\"incorrect-password\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test void logoutInvalidatesSession() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        members.save(new Member("logout@example.org", "단원",
                PasswordEncoderFactories.createDelegatingPasswordEncoder().encode("correct-horse-battery"), Clock.systemUTC()));
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                .contentType("application/json")
                .content("{\"email\":\"logout@example.org\",\"password\":\"correct-horse-battery\"}"));
        assertThat(mvc.perform(post("/api/v1/auth/logout").session(session).header("X-CSRF-TOKEN", csrf))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(session)).andReturn().getResponse().getStatus()).isEqualTo(401);
    }
}
