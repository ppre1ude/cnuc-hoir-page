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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.HashMap;
import java.util.Map;
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
import org.springframework.jdbc.core.JdbcTemplate;
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
    @Autowired MailOutboxService outbox;
    @Autowired JdbcTemplate jdbc;
    @Autowired MailDeliveryAttempt delivery;

    @Test void supersededQueuedJobDoesNotSendStaleLink() {
        Member member = members.save(new Member("superseded-reset@example.org", "단원",
                PasswordEncoderFactories.createDelegatingPasswordEncoder().encode("correct-horse-battery"), clock));
        resets.request(member.getEmail(), "127.0.0.101");
        Long id = jdbc.queryForObject("SELECT id FROM auth_mail_outbox WHERE member_id = ? AND purpose = ?",
                Long.class, member.getId(), MailOutboxService.RESET);
        Long oldRevision = jdbc.queryForObject("SELECT revision FROM auth_mail_outbox WHERE id = ?",
                Long.class, id);
        resets.request(member.getEmail(), "127.0.0.102");
        assertThat(jdbc.queryForObject("SELECT revision FROM auth_mail_outbox WHERE id = ?", Long.class, id))
                .isEqualTo(oldRevision + 1);
        mail.links.remove(member.getEmail());
        delivery.deliver(id, oldRevision);
        assertThat(mail.linkFor(member.getEmail())).isNull();
        outbox.dispatchDue();
        assertThat(mail.linkFor(member.getEmail())).contains("#token=");
    }

    @Test void smtpFailureKeepsPublicResponseAndRetriesAtDueTime() throws Exception {
        Member member = members.save(new Member("retry-reset@example.org", "단원",
                PasswordEncoderFactories.createDelegatingPasswordEncoder().encode("correct-horse-battery"), clock));
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        for (String address : new String[]{member.getEmail(), "unknown-reset@example.org"}) {
            assertThat(mvc.perform(post("/api/v1/auth/password-reset/request").session(session)
                    .header("X-CSRF-TOKEN", csrf).remoteAddress("127.0.0.71")
                    .contentType("application/json").content("{\"email\":\"" + address + "\"}"))
                    .andReturn().getResponse().getStatus()).isEqualTo(202);
        }
        mail.links.remove(member.getEmail());
        mail.fail = true;
        outbox.dispatchDue();
        assertThat(mail.linkFor(member.getEmail())).isNull();
        assertThat(jdbc.queryForObject("SELECT attempt_count FROM auth_mail_outbox WHERE member_id = ? AND purpose = ?",
                Integer.class, member.getId(), MailOutboxService.RESET)).isEqualTo(1);
        mail.fail = false;
        outbox.dispatchDue();
        assertThat(mail.linkFor(member.getEmail())).isNull();
        clock.advance(Duration.ofMinutes(1));
        outbox.dispatchDue();
        String delivered = mail.linkFor(member.getEmail());
        assertThat(delivered).contains("/reset-password#token=");
        assertThat(jdbc.queryForObject("SELECT token_hash FROM auth_token WHERE member_id = ? AND purpose = ? "
                        + "ORDER BY id DESC LIMIT 1", String.class, member.getId(), MailOutboxService.RESET))
                .isNotEqualTo(delivered.split("#token=", 2)[1]);
        outbox.dispatchDue();
        assertThat(mail.linkFor(member.getEmail())).isEqualTo(delivered);
        assertThat(jdbc.queryForObject("SELECT completed_at IS NOT NULL FROM auth_mail_outbox WHERE member_id = ? AND purpose = ?",
                Boolean.class, member.getId(), MailOutboxService.RESET)).isTrue();
        resets.request(member.getEmail(), "127.0.0.72");
        resets.request(member.getEmail(), "127.0.0.73");
        assertThatThrownBy(() -> resets.request(member.getEmail(), "127.0.0.74"))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus().value()).isEqualTo(429));
    }

    @Test void concurrentResetRequestAndConfirmationFinishWithoutLockCycle() throws Exception {
        Member member = members.save(new Member("parallel-reset@example.org", "단원",
                PasswordEncoderFactories.createDelegatingPasswordEncoder().encode("correct-horse-battery"), clock));
        resets.request(member.getEmail(), "127.0.0.81");
        outbox.dispatchDue();
        String token = mail.tokenFor(member.getEmail());
        CountDownLatch start = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            var request = workers.submit(() -> {
                start.await();
                resets.request(member.getEmail(), "127.0.0.82");
                return true;
            });
            var confirm = workers.submit(() -> {
                start.await();
                resets.confirm(token, "new-correct-horse-battery");
                return true;
            });
            start.countDown();
            assertThat(request.get(10, TimeUnit.SECONDS)).isTrue();
            assertThat(confirm.get(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test void failedResendKeepsPreviousResetLinkValid() {
        Member member = members.save(new Member("old-reset-link@example.org", "단원",
                PasswordEncoderFactories.createDelegatingPasswordEncoder().encode("correct-horse-battery"), clock));
        resets.request(member.getEmail(), "127.0.0.91");
        outbox.dispatchDue();
        String oldToken = mail.tokenFor(member.getEmail());
        resets.request(member.getEmail(), "127.0.0.92");
        mail.fail = true;
        outbox.dispatchDue();
        mail.fail = false;
        resets.confirm(oldToken, "new-correct-horse-battery");
        assertThat(members.findById(member.getId()).orElseThrow().getAuthVersion()).isEqualTo(1);
    }

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
        outbox.dispatchDue();
        String expired = mail.tokenFor(member.getEmail());
        clock.advance(Duration.ofMinutes(30));
        assertThatThrownBy(() -> resets.confirm(expired, "new-correct-horse-battery"))
                .isInstanceOf(ApiException.class);
        resets.request(member.getEmail(), "127.0.0.12");
        outbox.dispatchDue();
        String valid = mail.tokenFor(member.getEmail());
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
        final Map<String, String> links = new HashMap<>();
        boolean fail;
        public void sendVerification(String address, String link) {}
        public void sendPasswordReset(String address, String link) {
            if (fail) throw new IllegalStateException("테스트 송신 실패");
            links.put(address, link);
        }
        String linkFor(String address) { return links.get(address); }
        String tokenFor(String address) { return linkFor(address).split("#token=", 2)[1]; }
    }
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-09-27T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
        void advance(Duration duration) { now = now.plus(duration); }
    }
}
