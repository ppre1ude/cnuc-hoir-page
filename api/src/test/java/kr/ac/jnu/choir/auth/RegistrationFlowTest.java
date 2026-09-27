package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import kr.ac.jnu.choir.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.security.web.FilterChainProxy;
import org.junit.jupiter.api.BeforeEach;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest
@Testcontainers
class RegistrationFlowTest {
    @Container
    static final MySQLContainer database = new MySQLContainer("mysql:8.4");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
        registry.add("choir.mail.verify-base-url", () -> "https://choir.example/verify-email");
        registry.add("choir.mail.enabled", () -> "false");
    }

    @Autowired RegistrationService registration;
    @Autowired MemberRepository members;
    @Autowired TestMailSender mail;
    @Autowired MailOutboxService outbox;
    @Autowired MutableClock clock;
    @Autowired WebApplicationContext webContext;
    @Autowired FilterChainProxy securityFilter;
    MockMvc mvc;

    @BeforeEach
    void setUpMvc() {
        mvc = MockMvcBuilders.webAppContextSetup(webContext).addFilters(securityFilter).build();
    }

    @Test
    void publicEndpointsRequireCsrfForChanges() throws Exception {
        mvc.perform(post("/api/v1/auth/applications")
                .contentType("application/json")
                .content("{\"email\":\"http@example.org\",\"password\":\"correct-horse-battery\",\"name\":\"신청자\"}"))
                .andExpect(status().isForbidden());
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        mvc.perform(post("/api/v1/auth/applications")
                .session(session)
                .header("X-CSRF-TOKEN", csrf)
                .contentType("application/json")
                .content("{\"email\":\"http@example.org\",\"password\":\"correct-horse-battery\",\"name\":\"신청자\"}"))
                .andExpect(status().isAccepted());
        outbox.dispatchDue();
        mvc.perform(post("/api/v1/auth/verify-email")
                .session(session)
                .header("X-CSRF-TOKEN", csrf)
                .contentType("application/json")
                .content("{\"token\":\"" + mail.lastTokenFor("http@example.org") + "\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/member/private")).andExpect(status().isUnauthorized());
    }

    @Test
    void applicationAndOneUseVerification() {
        registration.apply("  PERSON@Example.org  ", "correct-horse-battery", "신청자");
        outbox.dispatchDue();
        Member member = members.findByEmailIgnoreCase("person@example.org").orElseThrow();
        assertThat(member.getEmail()).isEqualTo("person@example.org");
        assertThat(member.getStatus()).isEqualTo(AccountStatus.EMAIL_PENDING);
        assertThat(member.getPasswordHash()).doesNotContain("correct-horse-battery");
        String token = mail.lastTokenFor("person@example.org");
        assertThat(mail.lastMessageFor("person@example.org")).contains("https://choir.example/verify-email#token=");
        registration.verifyEmail(token);
        assertThat(members.findById(member.getId()).orElseThrow().getStatus()).isEqualTo(AccountStatus.APPROVAL_PENDING);
        assertThatThrownBy(() -> registration.verifyEmail(token)).hasMessageContaining("사용할 수 없는 확인 링크");
    }

    @Test
    void expiresAfterOneDayAndRejectsDuplicate() {
        registration.apply("expire@example.org", "correct-horse-battery", "신청자");
        outbox.dispatchDue();
        String token = mail.lastTokenFor("expire@example.org");
        assertThatThrownBy(() -> registration.apply("EXPIRE@example.org", "correct-horse-battery", "다른 사람"))
                .hasMessageContaining("이미 사용 중인 이메일");
        clock.advance(Duration.ofHours(24));
        assertThatThrownBy(() -> registration.verifyEmail(token)).hasMessageContaining("사용할 수 없는 확인 링크");
    }

    @Test
    void resendRevokesOldLinkAndLimitsFrequency() {
        registration.apply("resend@example.org", "correct-horse-battery", "신청자");
        outbox.dispatchDue();
        String oldToken = mail.lastTokenFor("resend@example.org");
        registration.resendVerification("unknown@example.org");
        registration.resendVerification("resend@example.org");
        assertThat(mail.countFor("resend@example.org")).isEqualTo(1);
        clock.advance(Duration.ofMinutes(10));
        registration.resendVerification("resend@example.org");
        outbox.dispatchDue();
        String newToken = mail.lastTokenFor("resend@example.org");
        assertThat(newToken).isNotEqualTo(oldToken);
        assertThatThrownBy(() -> registration.verifyEmail(oldToken)).hasMessageContaining("사용할 수 없는 확인 링크");
        registration.verifyEmail(newToken);
    }

    @Test
    void failedVerificationMailRetriesWithoutExposingAddress() throws Exception {
        registration.apply("retry-verify@example.org", "correct-horse-battery", "신청자");
        int sentBefore = mail.countFor("retry-verify@example.org");
        mail.fail = true;
        outbox.dispatchDue();
        assertThat(mail.countFor("retry-verify@example.org")).isEqualTo(sentBefore);
        var csrfResponse = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        String csrf = csrfResponse.getResponse().getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        for (String address : List.of("retry-verify@example.org", "unknown-verify@example.org")) {
            mvc.perform(post("/api/v1/auth/resend-verification").session(session)
                    .header("X-CSRF-TOKEN", csrf).contentType("application/json")
                    .content("{\"email\":\"" + address + "\"}"))
                    .andExpect(status().isAccepted());
        }
        mail.fail = false;
        outbox.dispatchDue();
        assertThat(mail.countFor("retry-verify@example.org")).isEqualTo(sentBefore);
        clock.advance(Duration.ofMinutes(1));
        outbox.dispatchDue();
        assertThat(mail.countFor("retry-verify@example.org")).isEqualTo(sentBefore + 1);
        String token = mail.lastTokenFor("retry-verify@example.org");
        outbox.dispatchDue();
        assertThat(mail.countFor("retry-verify@example.org")).isEqualTo(sentBefore + 1);
        clock.advance(Duration.ofHours(24));
        assertThatThrownBy(() -> registration.verifyEmail(token)).isInstanceOf(ApiException.class);
    }

    @Test
    void failedResendKeepsPreviouslyDeliveredLinkValid() {
        registration.apply("old-link@example.org", "correct-horse-battery", "신청자");
        outbox.dispatchDue();
        String oldToken = mail.lastTokenFor("old-link@example.org");
        clock.advance(Duration.ofMinutes(10));
        registration.resendVerification("old-link@example.org");
        mail.fail = true;
        outbox.dispatchDue();
        mail.fail = false;
        registration.verifyEmail(oldToken);
        assertThat(members.findByEmailIgnoreCase("old-link@example.org").orElseThrow().getStatus())
                .isEqualTo(AccountStatus.APPROVAL_PENDING);
    }

    @Test
    void rejectsPasswordBeyondSeventyTwoUtf8Bytes() {
        String seventyTwoBytes = "a".repeat(69) + "가";
        String seventyThreeBytes = "a".repeat(70) + "가";
        registration.apply("limit72@example.org", seventyTwoBytes, "신청자");
        assertThat(members.findByEmailIgnoreCase("limit72@example.org")).isPresent();
        assertThatThrownBy(() -> registration.apply("limit73@example.org", seventyThreeBytes, "신청자"))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getStatus().value()).isEqualTo(400));
        assertThat(members.findByEmailIgnoreCase("limit73@example.org")).isEmpty();
    }

    @Test
    void rejectsMalformedAddressBeforeMailAndAcceptsPlusTag() {
        int sentBefore = mail.totalCount();
        for (String address : List.of("person@example..org", "person@example.org.",
                ".person@example.org", "person..name@example.org", "person@-example.org")) {
            assertThatThrownBy(() -> registration.apply(address, "correct-horse-battery", "신청자"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(error -> assertThat(((ApiException) error).getStatus().value()).isEqualTo(400));
        }
        assertThat(mail.totalCount()).isEqualTo(sentBefore);
        registration.apply("person+choir@example.org", "correct-horse-battery", "신청자");
        assertThat(members.findByEmailIgnoreCase("person+choir@example.org")).isPresent();
    }

    @TestConfiguration
    static class TestMailConfiguration {
        @Bean @Primary TestMailSender testMailSender() { return new TestMailSender(); }
        @Bean @Primary MutableClock mutableClock() { return new MutableClock(); }
    }

    static class TestMailSender implements MailSender {
        final Map<String, List<String>> messages = new HashMap<>();
        boolean fail;
        public void sendVerification(String address, String link) {
            if (fail) throw new IllegalStateException("테스트 송신 실패");
            messages.computeIfAbsent(address, ignored -> new ArrayList<>()).add(link);
        }
        public void sendPasswordReset(String address, String link) {
            messages.computeIfAbsent(address, ignored -> new ArrayList<>()).add(link);
        }
        int countFor(String address) { return messages.getOrDefault(address, List.of()).size(); }
        int totalCount() { return messages.values().stream().mapToInt(List::size).sum(); }
        String lastMessageFor(String address) { return messages.get(address).getLast(); }
        String lastTokenFor(String address) { return lastMessageFor(address).split("#token=", 2)[1]; }
    }

    static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-09-27T00:00:00Z");
        public ZoneOffset getZone() { return ZoneOffset.UTC; }
        public Clock withZone(java.time.ZoneId zone) { return this; }
        public Instant instant() { return now; }
        void advance(Duration duration) { now = now.plus(duration); }
    }
}
