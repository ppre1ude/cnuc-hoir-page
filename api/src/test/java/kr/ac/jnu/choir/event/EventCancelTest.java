package kr.ac.jnu.choir.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@Testcontainers
class EventCancelTest {
    @Container static final PostgreSQLContainer database = new PostgreSQLContainer("postgres:17-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", database::getJdbcUrl);
        registry.add("spring.datasource.username", database::getUsername);
        registry.add("spring.datasource.password", database::getPassword);
    }

    private static final String ATTEND = "{\"choice\":\"ATTENDING\"}";

    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy security;
    @Autowired MemberRepository members;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;
    MockHttpSession admin;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
        admin = session(true);
    }

    private MockHttpSession session(boolean isAdmin) {
        Member member = members.save(new Member(UUID.randomUUID() + "@example.org", "단원", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = 'ACTIVE', admin = ?, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                isAdmin, member.getId());
        Member saved = members.findById(member.getId()).orElseThrow();
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", saved.getId());
        session.setAttribute("authVersion", saved.getAuthVersion());
        return session;
    }

    private MockHttpServletResponse send(MockHttpServletRequestBuilder request, MockHttpSession session, String body) throws Exception {
        String csrf = mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn().getResponse().getContentAsString()
                .split("\"token\":\"", 2)[1].split("\"", 2)[0];
        request.session(session).header("X-CSRF-TOKEN", csrf);
        if (body != null) request.contentType("application/json").content(body);
        return mvc.perform(request).andReturn().getResponse();
    }

    private String read(String path, MockHttpSession session) throws Exception {
        return mvc.perform(get(path).session(session)).andReturn().getResponse().getContentAsString();
    }

    private static String field(String json, String name) {
        return json.split("\"" + name + "\":\"?", 2)[1].split("[\",}]", 2)[0];
    }

    private static String input(Instant start, String title) {
        return "{\"title\":\"" + title + "\",\"description\":\"\",\"startAt\":\"" + start + "\",\"endAt\":\"" + start.plus(2, ChronoUnit.HOURS)
                + "\",\"kind\":\"EVENT\",\"obEligible\":false,\"publicVisible\":false}";
    }

    private long create(Instant start, String title) throws Exception {
        return Long.parseLong(field(send(post("/api/v1/admin/events"), admin, input(start, title)).getContentAsString(), "id"));
    }

    @Test void cancelKeepsRecordsAndStopsRsvpAndCheckInUntilRestored() throws Exception {
        // 시작 10분 전이라 응답도 받고 출석 창도 열 수 있는 일정입니다.
        long id = create(Instant.now().plus(10, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.SECONDS), "곧 시작하는 연습");
        String path = "/api/v1/events/" + id;
        MockHttpSession responder = session(false);
        MockHttpSession attendee = session(false);
        MockHttpSession latecomer = session(false);
        assertThat(send(put(path + "/rsvp"), responder, ATTEND).getStatus()).isEqualTo(200);
        String code = field(send(post("/api/v1/admin/events/" + id + "/check-in-session"), admin, null).getContentAsString(), "code");
        String credential = "{\"credential\":\"" + code + "\"}";
        assertThat(send(post(path + "/check-ins"), attendee, credential).getStatus()).isLessThan(300);

        assertThat(field(send(post("/api/v1/admin/events/" + id + "/cancel"), admin, null).getContentAsString(), "cancelledAt")).isNotEqualTo("null");

        // 일정은 단원 목록에 취소 상태로 남습니다.
        assertThat(field(read(path, responder), "cancelledAt")).isNotEqualTo("null");
        // 응답, 출석 창 열기, 출석을 모두 막고 이유를 코드로 알립니다.
        for (var refused : new MockHttpServletResponse[] {
                send(put(path + "/rsvp"), responder, ATTEND),
                send(post("/api/v1/admin/events/" + id + "/check-in-session"), admin, null),
                send(post(path + "/check-ins"), latecomer, credential)}) {
            assertThat(refused.getStatus()).isEqualTo(409);
            assertThat(refused.getContentAsString()).contains("EVENT_CANCELLED");
        }
        // 열려 있던 창은 닫힙니다.
        assertThat(read("/api/v1/admin/events/" + id + "/check-in-session", admin)).contains("\"open\":false", "\"code\":null");
        // 받은 기록은 그대로입니다.
        assertThat(read("/api/v1/admin/events/" + id + "/rsvps", admin)).contains("\"attending\":1");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance WHERE event_id = ?", Long.class, id)).isEqualTo(1);
        assertThat(read("/api/v1/attendance/me", attendee)).contains("곧 시작하는 연습", "CHECKED_IN");
        // 기록이 없는 단원에게는 미출석으로 잡히지 않습니다.
        assertThat(read("/api/v1/attendance/me", responder)).doesNotContain("곧 시작하는 연습");
        assertThat(read(path + "/attendance/me", responder)).contains("NOT_ELIGIBLE").doesNotContain("MISSED");

        var refusedDelete = send(delete("/api/v1/admin/events/" + id), admin, null);
        assertThat(refusedDelete.getStatus()).isEqualTo(409);
        assertThat(refusedDelete.getContentAsString()).contains("EVENT_HAS_RECORDS");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM event WHERE id = ?", Long.class, id)).isEqualTo(1);

        assertThat(field(send(post("/api/v1/admin/events/" + id + "/restore"), admin, null).getContentAsString(), "cancelledAt")).isEqualTo("null");
        assertThat(send(put(path + "/rsvp"), responder, "{\"choice\":\"ABSENT\"}").getStatus()).isEqualTo(200);
        // 되돌려도 창은 저절로 열리지 않고, 운영진이 다시 열 수 있습니다.
        assertThat(read("/api/v1/admin/events/" + id + "/check-in-session", admin)).contains("\"open\":false");
        assertThat(send(post("/api/v1/admin/events/" + id + "/check-in-session"), admin, null).getStatus()).isLessThan(300);
    }

    @Test void onlyCancelledEventsWithoutRecordsCanBeDeleted() throws Exception {
        long id = create(Instant.parse("2099-11-05T10:00:00Z"), "잘못 등록한 일정");
        var notCancelled = send(delete("/api/v1/admin/events/" + id), admin, null);
        assertThat(notCancelled.getStatus()).isEqualTo(409);
        assertThat(notCancelled.getContentAsString()).contains("EVENT_NOT_CANCELLED");
        send(post("/api/v1/admin/events/" + id + "/cancel"), admin, null);
        assertThat(send(delete("/api/v1/admin/events/" + id), admin, null).getStatus()).isEqualTo(204);
        assertThat(mvc.perform(get("/api/v1/events/" + id).session(admin)).andReturn().getResponse().getStatus()).isEqualTo(404);
    }

    @Test void cancelledEventDoesNotBlockRegisteringSameTitleAndTimeAgain() throws Exception {
        Instant start = Instant.parse("2099-11-11T10:00:00Z");
        long id = create(start, "정기 연습");
        String batch = "{\"events\":[" + input(start, "정기 연습") + "]}";
        assertThat(send(post("/api/v1/admin/events/batch"), admin, batch).getStatus()).isEqualTo(409);
        send(post("/api/v1/admin/events/" + id + "/cancel"), admin, null);
        assertThat(send(post("/api/v1/admin/events/batch"), admin, batch).getStatus()).isEqualTo(201);
    }
}
