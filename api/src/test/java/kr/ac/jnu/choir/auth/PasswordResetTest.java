package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest
@Testcontainers
class PasswordResetTest {
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
        registry.add("choir.mail.enabled", () -> "false");
    }
    @Autowired PasswordResetService resets;
    @Autowired MemberRepository members;
    @Autowired TestMail mail;
    @Autowired MutableClock clock;
    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;

    @Test void expiresAndCannotReuseAndInvalidatesOldVersion() throws Exception {
        Member member = members.save(new Member("reset@example.org", "단원",
                PasswordEncoderFactories.createDelegatingPasswordEncoder().encode("correct-horse-battery"), clock));
        long oldVersion = member.getAuthVersion();
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        assertThat(mvc.perform(post("/api/v1/auth/login").session(session).header("X-CSRF-TOKEN", csrf)
                .contentType("application/json")
                .content("{\"email\":\"reset@example.org\",\"password\":\"correct-horse-battery\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        resets.request(member.getEmail(), "127.0.0.11");
        String expired = mail.token();
        clock.advance(Duration.ofMinutes(30));
        assertThatThrownBy(() -> resets.confirm(expired, "new-correct-horse-battery"))
                .isInstanceOf(ApiException.class);
        resets.request(member.getEmail(), "127.0.0.12");
        String valid = mail.token();
        assertThatThrownBy(() -> resets.confirm(valid, "a".repeat(70) + "가"))
                .isInstanceOf(ApiException.class);
        resets.confirm(valid, "new-correct-horse-battery");
        assertThat(members.findById(member.getId()).orElseThrow().getAuthVersion()).isEqualTo(oldVersion + 1);
        assertThat(mvc.perform(get("/api/v1/auth/me").session(session)).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThatThrownBy(() -> resets.confirm(valid, "another-correct-horse-battery"))
                .isInstanceOf(ApiException.class);
    }

    @TestConfiguration static class TestConfig {
        @Bean @Primary TestMail mail() { return new TestMail(); }
        @Bean @Primary MutableClock mutableClock() { return new MutableClock(); }
    }
    static class TestMail implements MailSender {
        String link;
        public void sendVerification(String address, String link) {}
        public void sendPasswordReset(String address, String link) { this.link = link; }
        String token() { return link.split("#token=", 2)[1]; }
    }
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-09-27T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
        void advance(Duration duration) { now = now.plus(duration); }
    }
}
