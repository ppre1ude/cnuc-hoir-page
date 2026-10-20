package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Clock;
import java.util.UUID;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import kr.ac.jnu.choir.member.Part;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@Testcontainers
class ApplicationReportTest {
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

    @Test void pendingApplicantReportsNameCohortAndPartAndKeepsThemAfterApproval() throws Exception {
        Member applicant = applicant();
        MockHttpSession session = sessionFor(applicant);

        MockHttpServletResponse saved = report(session, "{\"name\":\"  홍길동  \",\"cohort\":5,\"part\":\"SOPRANO\"}");
        assertThat(saved.getStatus()).isEqualTo(200);
        assertThat(json(saved).path("status").asText()).isEqualTo("APPROVAL_PENDING");

        JsonNode me = mapper.readTree(mvc.perform(get("/api/v1/auth/me").session(session))
                .andReturn().getResponse().getContentAsString());
        assertThat(me.path("name").asText()).isEqualTo("홍길동");
        assertThat(me.path("cohort").asInt()).isEqualTo(5);
        assertThat(me.path("part").asText()).isEqualTo("SOPRANO");

        assertThat(report(session, "{\"name\":\"홍길동\",\"cohort\":6,\"part\":\"ALTO\"}").getStatus()).isEqualTo(200);

        MockHttpSession adminSession = sessionFor(admin());
        assertThat(mvc.perform(post("/api/v1/admin/applications/" + applicant.getId() + "/approve")
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"memberType\":\"ACTIVE\"}")).andReturn().getResponse().getStatus()).isEqualTo(204);
        Member approved = members.findById(applicant.getId()).orElseThrow();
        assertThat(approved.getName()).isEqualTo("홍길동");
        assertThat(approved.getPart()).isEqualTo(Part.ALTO);
        assertThat(approved.getCohort()).isEqualTo(6);
    }

    @Test void applicationsListShowsReportedPartAndCohort() throws Exception {
        Member reported = applicant();
        Member silent = applicant();
        assertThat(report(sessionFor(reported), "{\"name\":\"김민지\",\"cohort\":12,\"part\":\"TENOR\"}")
                .getStatus()).isEqualTo(200);

        JsonNode items = mapper.readTree(mvc.perform(get("/api/v1/admin/applications?size=100").session(sessionFor(admin())))
                .andReturn().getResponse().getContentAsString()).path("items");
        JsonNode reportedItem = item(items, reported.getId());
        assertThat(reportedItem.path("name").asText()).isEqualTo("김민지");
        assertThat(reportedItem.path("part").asText()).isEqualTo("TENOR");
        assertThat(reportedItem.path("cohort").asInt()).isEqualTo(12);
        JsonNode silentItem = item(items, silent.getId());
        assertThat(silentItem.has("part")).isTrue();
        assertThat(silentItem.path("part").isNull()).isTrue();
        assertThat(silentItem.path("cohort").isNull()).isTrue();
    }

    @Test void approvedAccountCannotReportApplication() throws Exception {
        Member approved = admin();
        MockHttpServletResponse response = report(sessionFor(approved),
                "{\"name\":\"홍길동\",\"cohort\":5,\"part\":\"SOPRANO\"}");
        assertThat(response.getStatus()).isEqualTo(409);
        assertThat(json(response).path("message").asText()).isNotBlank();
        assertThat(members.findById(approved.getId()).orElseThrow().getPart()).isNull();
    }

    @Test void anonymousRequestIsUnauthenticated() throws Exception {
        assertThat(report(new MockHttpSession(), "{\"name\":\"홍길동\",\"cohort\":5,\"part\":\"SOPRANO\"}").getStatus())
                .isEqualTo(401);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"name\":\"홍길동\",\"cohort\":0,\"part\":\"SOPRANO\"}",
            "{\"name\":\"홍길동\",\"cohort\":100,\"part\":\"SOPRANO\"}",
            "{\"name\":\"홍길동\",\"part\":\"SOPRANO\"}",
            "{\"name\":\"홍길동\",\"cohort\":5,\"part\":\"CONDUCTOR\"}",
            "{\"name\":\"홍길동\",\"cohort\":5}",
            "{\"name\":\"   \",\"cohort\":5,\"part\":\"SOPRANO\"}",
            "{\"cohort\":5,\"part\":\"SOPRANO\"}",
            "{\"name\":\"가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파\",\"cohort\":5,\"part\":\"SOPRANO\"}"
    })
    void invalidApplicationIsRejected(String body) throws Exception {
        Member applicant = applicant();
        assertThat(report(sessionFor(applicant), body).getStatus()).isEqualTo(400);
        Member unchanged = members.findById(applicant.getId()).orElseThrow();
        assertThat(unchanged.getPart()).isNull();
        assertThat(unchanged.getCohort()).isNull();
    }

    private MockHttpServletResponse report(MockHttpSession session, String body) throws Exception {
        return mvc.perform(put("/api/v1/auth/application").session(session)
                .header("X-CSRF-TOKEN", csrf(session)).contentType("application/json").content(body))
                .andReturn().getResponse();
    }

    private static JsonNode item(JsonNode items, Long id) {
        for (JsonNode item : items) if (item.path("id").asLong() == id) return item;
        throw new AssertionError("신청 목록에 " + id + "번 계정이 없습니다.");
    }

    private JsonNode json(MockHttpServletResponse response) throws Exception {
        return mapper.readTree(response.getContentAsString());
    }

    private Member applicant() {
        return members.save(Member.googleApplicant("applicant-" + UUID.randomUUID() + "@example.org", "Gildong",
                "sub-" + UUID.randomUUID(), Clock.systemUTC()));
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
