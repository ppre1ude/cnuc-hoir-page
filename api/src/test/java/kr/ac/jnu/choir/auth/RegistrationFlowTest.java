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
import java.util.List;
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
        mvc.perform(post("/api/v1/auth/verify-email")
                .session(session)
                .header("X-CSRF-TOKEN", csrf)
                .contentType("application/json")
                .content("{\"token\":\"" + mail.lastToken() + "\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/member/private")).andExpect(status().isUnauthorized());
    }

    @Test
    void applicationAndOneUseVerification() {
        registration.apply("  PERSON@Example.org  ", "correct-horse-battery", "신청자");
        Member member = members.findByEmailIgnoreCase("person@example.org").orElseThrow();
        assertThat(member.getEmail()).isEqualTo("person@example.org");
        assertThat(member.getStatus()).isEqualTo(AccountStatus.EMAIL_PENDING);
        assertThat(member.getPasswordHash()).doesNotContain("correct-horse-battery");
        String token = mail.lastToken();
        assertThat(mail.lastMessage()).contains("https://choir.example/verify-email#token=");
        registration.verifyEmail(token);
        assertThat(members.findById(member.getId()).orElseThrow().getStatus()).isEqualTo(AccountStatus.APPROVAL_PENDING);
        assertThatThrownBy(() -> registration.verifyEmail(token)).hasMessageContaining("사용할 수 없는 확인 링크");
    }

    @Test
    void expiresAfterOneDayAndRejectsDuplicate() {
        registration.apply("expire@example.org", "correct-horse-battery", "신청자");
        String token = mail.lastToken();
        assertThatThrownBy(() -> registration.apply("EXPIRE@example.org", "correct-horse-battery", "다른 사람"))
                .hasMessageContaining("이미 사용 중인 이메일");
        clock.advance(Duration.ofHours(24));
        assertThatThrownBy(() -> registration.verifyEmail(token)).hasMessageContaining("사용할 수 없는 확인 링크");
    }

    @Test
    void resendRevokesOldLinkAndLimitsFrequency() {
        registration.apply("resend@example.org", "correct-horse-battery", "신청자");
        String oldToken = mail.lastToken();
        registration.resendVerification("unknown@example.org");
        registration.resendVerification("resend@example.org");
        assertThat(mail.messages).hasSize(1);
        clock.advance(Duration.ofMinutes(10));
        registration.resendVerification("resend@example.org");
        String newToken = mail.lastToken();
        assertThat(newToken).isNotEqualTo(oldToken);
        assertThatThrownBy(() -> registration.verifyEmail(oldToken)).hasMessageContaining("사용할 수 없는 확인 링크");
        registration.verifyEmail(newToken);
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
        int sentBefore = mail.messages.size();
        for (String address : List.of("person@example..org", "person@example.org.",
                ".person@example.org", "person..name@example.org", "person@-example.org")) {
            assertThatThrownBy(() -> registration.apply(address, "correct-horse-battery", "신청자"))
                    .isInstanceOf(ApiException.class)
                    .satisfies(error -> assertThat(((ApiException) error).getStatus().value()).isEqualTo(400));
        }
        assertThat(mail.messages).hasSize(sentBefore);
        registration.apply("person+choir@example.org", "correct-horse-battery", "신청자");
        assertThat(members.findByEmailIgnoreCase("person+choir@example.org")).isPresent();
    }

    @TestConfiguration
    static class TestMailConfiguration {
        @Bean @Primary TestMailSender testMailSender() { return new TestMailSender(); }
        @Bean @Primary MutableClock mutableClock() { return new MutableClock(); }
    }

    static class TestMailSender implements MailSender {
        final List<String> messages = new ArrayList<>();
        public void sendVerification(String address, String link) { messages.add(link); }
        public void sendPasswordReset(String address, String link) { messages.add(link); }
        String lastMessage() { return messages.getLast(); }
        String lastToken() { return lastMessage().split("#token=", 2)[1]; }
    }

    static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-09-27T00:00:00Z");
        public ZoneOffset getZone() { return ZoneOffset.UTC; }
        public Clock withZone(java.time.ZoneId zone) { return this; }
        public Instant instant() { return now; }
        void advance(Duration duration) { now = now.plus(duration); }
    }
}
