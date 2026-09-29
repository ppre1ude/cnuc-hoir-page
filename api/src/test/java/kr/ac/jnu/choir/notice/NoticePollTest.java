package kr.ac.jnu.choir.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import kr.ac.jnu.choir.auth.MailSender;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@Testcontainers
@Import(NoticePollTest.MailConfiguration.class)
class NoticePollTest {
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
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        jdbc.update("DELETE FROM notice_poll_vote");
        jdbc.update("DELETE FROM notice_poll");
        jdbc.update("DELETE FROM notice");
    }

    private Member member(String name, String status, boolean admin) {
        Member value = members.save(new Member(UUID.randomUUID() + "@example.org", name,
                "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = ?, admin = ?, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                status, admin, value.getId());
        return members.findById(value.getId()).orElseThrow();
    }

    private MockHttpSession session(Member member) {
        MockHttpSession result = new MockHttpSession();
        result.setAttribute("memberId", member.getId());
        result.setAttribute("authVersion", member.getAuthVersion());
        return result;
    }

    private String csrf(MockHttpSession session) throws Exception {
        JsonNode response = json.readTree(mvc.perform(get("/api/v1/auth/csrf").session(session))
                .andReturn().getResponse().getContentAsString());
        return response.get("token").asText();
    }

    private long createPoll(Member admin, boolean published) throws Exception {
        MockHttpSession session = session(admin);
        String body = json.writeValueAsString(Map.of(
                "title", "연습 참여 조사",
                "body", "이번 주 연습 참여 여부를 알려주세요.",
                "published", published,
                "poll", Map.of("question", "연습에 참석하시나요?", "firstOption", "참석",
                        "secondOption", "불참", "closesAt", Instant.now().plusSeconds(3600))));
        var response = mvc.perform(post("/api/v1/admin/notices").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json").content(body))
                .andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(201);
        return json.readTree(response.getContentAsString()).get("id").asLong();
    }

    private JsonNode vote(long noticeId, MockHttpSession session, int choice) throws Exception {
        var response = mvc.perform(put("/api/v1/notices/" + noticeId + "/poll/vote").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json")
                .content("{\"choice\":" + choice + "}"))
                .andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(200);
        return json.readTree(response.getContentAsString());
    }

    @Test void approvedMemberCanChangeVoteAndOnlyAdminSeesRespondents() throws Exception {
        Member admin = member("운영진", "APPROVED", true);
        Member voter = member("단원", "APPROVED", false);
        long id = createPoll(admin, true);
        MockHttpSession voterSession = session(voter);

        JsonNode first = vote(id, voterSession, 1);
        assertThat(first.get("firstCount").asLong()).isEqualTo(1);
        assertThat(first.get("myChoice").asInt()).isEqualTo(1);
        JsonNode changed = vote(id, voterSession, 2);
        assertThat(changed.get("firstCount").asLong()).isZero();
        assertThat(changed.get("secondCount").asLong()).isEqualTo(1);
        assertThat(changed.get("myChoice").asInt()).isEqualTo(2);
        assertThat(changed.has("respondents")).isFalse();

        String memberView = mvc.perform(get("/api/v1/notices/" + id + "/poll").session(voterSession))
                .andReturn().getResponse().getContentAsString();
        assertThat(memberView).doesNotContain(voter.getEmail(), "respondents");
        String adminView = mvc.perform(get("/api/v1/admin/notices/" + id + "/poll")
                .session(session(admin))).andReturn().getResponse().getContentAsString();
        assertThat(adminView).contains("단원", voter.getEmail(), "\"choice\":2");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notice_poll_vote WHERE member_id = ?",
                Integer.class, voter.getId())).isEqualTo(1);
    }

    @Test void draftAndUnapprovedMembersCannotVote() throws Exception {
        Member admin = member("운영진", "APPROVED", true);
        Member voter = member("단원", "APPROVED", false);
        Member pending = member("대기", "APPROVAL_PENDING", false);
        long draft = createPoll(admin, false);
        MockHttpSession voterSession = session(voter);
        assertThat(mvc.perform(get("/api/v1/notices/" + draft + "/poll").session(voterSession))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(put("/api/v1/notices/" + draft + "/poll/vote").session(voterSession)
                .header("X-CSRF-TOKEN", csrf(voterSession)).contentType("application/json")
                .content("{\"choice\":1}")).andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(get("/api/v1/notices/" + draft + "/poll").session(session(pending)))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(get("/api/v1/notices/" + draft + "/poll"))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(get("/api/v1/admin/notices/" + draft + "/poll")
                .session(session(voter))).andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    @Test void closedPollRejectsNewVotesAndKeepsResult() throws Exception {
        Member admin = member("운영진", "APPROVED", true);
        Member voter = member("단원", "APPROVED", false);
        long id = createPoll(admin, true);
        vote(id, session(voter), 1);
        jdbc.update("UPDATE notice_poll SET closes_at = ? WHERE notice_id = ?",
                LocalDateTime.ofInstant(Instant.now().minusSeconds(1), ZoneOffset.UTC), id);
        MockHttpSession session = session(voter);
        var response = mvc.perform(put("/api/v1/notices/" + id + "/poll/vote").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json")
                .content("{\"choice\":2}")).andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(409);
        JsonNode result = json.readTree(mvc.perform(get("/api/v1/notices/" + id + "/poll")
                .session(session)).andReturn().getResponse().getContentAsString());
        assertThat(result.get("closed").asBoolean()).isTrue();
        assertThat(result.get("myChoice").asInt()).isEqualTo(1);
    }

    @Test void invalidChoiceAndSecondPollAreRejected() throws Exception {
        Member admin = member("운영진", "APPROVED", true);
        Member voter = member("단원", "APPROVED", false);
        long id = createPoll(admin, true);
        MockHttpSession voterSession = session(voter);
        assertThat(mvc.perform(put("/api/v1/notices/" + id + "/poll/vote").session(voterSession)
                .header("X-CSRF-TOKEN", csrf(voterSession)).contentType("application/json")
                .content("{\"choice\":3}")).andReturn().getResponse().getStatus()).isEqualTo(400);
        MockHttpSession adminSession = session(admin);
        String body = "{\"title\":\"변경\",\"body\":\"본문\",\"published\":true,"
                + "\"poll\":{\"question\":\"다른 질문\",\"firstOption\":\"찬성\","
                + "\"secondOption\":\"반대\",\"closesAt\":\""
                + Instant.now().plusSeconds(7200) + "\"}}";
        assertThat(mvc.perform(put("/api/v1/admin/notices/" + id).session(adminSession)
                .header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content(body)).andReturn().getResponse().getStatus()).isEqualTo(409);
        assertThat(mvc.perform(get("/api/v1/notices/" + id).session(voterSession))
                .andReturn().getResponse().getContentAsString()).contains("연습 참여 조사");
    }
}
