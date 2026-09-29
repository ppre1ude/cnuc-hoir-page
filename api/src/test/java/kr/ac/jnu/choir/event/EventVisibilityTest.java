package kr.ac.jnu.choir.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Clock;
import java.util.UUID;
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
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest
@Testcontainers
class EventVisibilityTest {
    @Container static final MySQLContainer database = new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
    }

    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MemberRepository members;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        jdbc.update("DELETE FROM event");
    }

    private Member member(boolean admin, String type) {
        Member member = members.save(new Member(UUID.randomUUID() + "@example.org", "단원", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = ?, admin = ?, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                type, admin, member.getId());
        return members.findById(member.getId()).orElseThrow();
    }

    private MockHttpSession session(Member member) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return session;
    }

    private String csrf(MockHttpSession session) throws Exception {
        String response = mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn()
                .getResponse().getContentAsString();
        return response.split("\"token\":\"", 2)[1].split("\"", 2)[0];
    }

    private String input(String title, String from, String to, boolean ob, boolean visible) {
        return "{\"title\":\"" + title + "\",\"description\":\"행사 설명\",\"startAt\":\"" + from
                + "\",\"endAt\":\"" + to + "\",\"obEligible\":" + ob + ",\"publicVisible\":" + visible + "}";
    }

    private long create(Member admin, String body) throws Exception {
        MockHttpSession session = session(admin);
        var response = mvc.perform(post("/api/v1/admin/events").session(session).header("X-CSRF-TOKEN", csrf(session))
                .contentType("application/json").content(body)).andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(201);
        return Long.parseLong(response.getContentAsString().split("\"id\":", 2)[1].split("[,}]", 2)[0]);
    }

    @Test void onlyApprovedMembersCanReadAndOnlyAdminsCanWrite() throws Exception {
        Member admin = member(true, "ACTIVE");
        Member active = member(false, "ACTIVE");
        Member ob = member(false, "OB");
        long id = create(admin, input("정기 연습", "2026-09-20T09:00:00Z", "2026-09-20T11:00:00Z", false, true));
        assertThat(mvc.perform(get("/api/v1/events?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z"))
                .andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(get("/api/v1/public/events")).andReturn().getResponse().getStatus()).isEqualTo(404);
        assertThat(mvc.perform(get("/api/v1/public/events/" + id)).andReturn().getResponse().getStatus()).isEqualTo(401);
        MockHttpSession anonymous = new MockHttpSession();
        assertThat(mvc.perform(post("/api/v1/public/events").session(anonymous)
                .header("X-CSRF-TOKEN", csrf(anonymous))).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(get("/api/v1/events/" + id)).andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(mvc.perform(get("/api/v1/admin/events")).andReturn().getResponse().getStatus()).isEqualTo(401);
        String obDetail = mvc.perform(get("/api/v1/events/" + id).session(session(ob))).andReturn()
                .getResponse().getContentAsString();
        assertThat(obDetail).contains("정기 연습", "\"obEligible\":false", "\"publicVisible\":true");
        MockHttpSession normal = session(active);
        assertThat(mvc.perform(post("/api/v1/admin/events").session(normal).header("X-CSRF-TOKEN", csrf(normal))
                .contentType("application/json").content(input("침입", "2026-09-20T09:00:00Z", "2026-09-20T11:00:00Z", true, false)))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    @Test void dateRangeUsesHalfOpenOverlapAndOrdersByStart() throws Exception {
        Member admin = member(true, "ACTIVE");
        Member member = member(false, "ACTIVE");
        create(admin, input("이전", "2026-08-30T00:00:00Z", "2026-09-01T00:00:00Z", true, false));
        create(admin, input("겹침", "2026-08-31T23:00:00Z", "2026-09-01T01:00:00Z", true, false));
        create(admin, input("다음", "2026-09-10T00:00:00Z", "2026-09-10T02:00:00Z", true, false));
        create(admin, input("경계", "2026-10-01T00:00:00Z", "2026-10-01T02:00:00Z", true, false));
        String response = mvc.perform(get("/api/v1/events?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z")
                .session(session(member))).andReturn().getResponse().getContentAsString();
        assertThat(response).contains("겹침", "다음").doesNotContain("이전", "경계");
        assertThat(response.indexOf("겹침")).isLessThan(response.indexOf("다음"));
    }

    @Test void rejectsInvalidIntervalAndUpdatesEligibility() throws Exception {
        Member admin = member(true, "ACTIVE");
        MockHttpSession editor = session(admin);
        String bad = input("역순", "2026-09-20T11:00:00Z", "2026-09-20T09:00:00Z", false, false);
        assertThat(mvc.perform(post("/api/v1/admin/events").session(editor).header("X-CSRF-TOKEN", csrf(editor))
                .contentType("application/json").content(bad)).andReturn().getResponse().getStatus()).isEqualTo(400);
        long id = create(admin, input("합창", "2026-09-20T09:00:00Z", "2026-09-20T11:00:00Z", false, false));
        String updated = input("합창 수정", "2026-09-20T09:00:00Z", "2026-09-20T11:00:00Z", true, true);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id).session(editor).header("X-CSRF-TOKEN", csrf(editor))
                .contentType("application/json").content(updated)).andReturn().getResponse().getStatus()).isEqualTo(200);
        String detail = mvc.perform(get("/api/v1/events/" + id).session(session(admin))).andReturn()
                .getResponse().getContentAsString();
        assertThat(detail).contains("합창 수정", "\"obEligible\":true", "\"publicVisible\":true");
        assertThat(mvc.perform(get("/api/v1/events?from=2026-10-01T00:00:00Z&to=2026-09-01T00:00:00Z")
                .session(session(admin))).andReturn().getResponse().getStatus()).isEqualTo(400);
    }
}
