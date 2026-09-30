package kr.ac.jnu.choir.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import kr.ac.jnu.choir.event.EventService;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import kr.ac.jnu.choir.notice.NoticeService;
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
class AuthorizationMatrixTest {
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
    @Autowired EventService events;
    @Autowired NoticeService notices;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
    }

    private MockHttpSession session(String status, String type, boolean admin) {
        if (status == null) return null;
        Member created = members.save(new Member(UUID.randomUUID() + "@example.org", "단원", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = ?, member_type = ?, admin = ?, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                status, type, admin, created.getId());
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", created.getId());
        session.setAttribute("authVersion", created.getAuthVersion());
        return session;
    }

    private int getStatus(String path, MockHttpSession session) throws Exception {
        var request = get(path);
        if (session != null) request.session(session);
        return mvc.perform(request).andReturn().getResponse().getStatus();
    }

    @Test void roleMatrixProtectsMemberAndAdminReads() throws Exception {
        Member author = members.save(new Member(UUID.randomUUID() + "@example.org", "작성자", "{noop}password", Clock.systemUTC()));
        long noticeId = notices.create("권한 표 공지", "본문", true, author).getId();
        long eventId = events.create("권한 표 행사", "내용", Instant.parse("2026-09-20T09:00:00Z"),
                Instant.parse("2026-09-20T11:00:00Z"), true, false).getId();
        record Role(String name, MockHttpSession session, int memberStatus, int adminStatus) {}
        List<Role> roles = List.of(
                new Role("방문자", new MockHttpSession(), 401, 401),
                new Role("승인 대기", session("APPROVAL_PENDING", null, false), 403, 403),
                new Role("접근 해제", session("REVOKED", "ACTIVE", false), 401, 401),
                new Role("활동 단원", session("APPROVED", "ACTIVE", false), 200, 403),
                new Role("OB", session("APPROVED", "OB", false), 200, 403),
                new Role("운영진", session("APPROVED", "ACTIVE", true), 200, 200));
        List<String> memberPaths = List.of(
                "/api/v1/notices", "/api/v1/notices/" + noticeId,
                "/api/v1/events?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z",
                "/api/v1/events/" + eventId, "/api/v1/events/" + eventId + "/attendance/me",
                "/api/v1/attendance/me");
        List<String> adminPaths = List.of(
                "/api/v1/admin/applications", "/api/v1/admin/notices",
                "/api/v1/admin/events/" + eventId + "/attendance",
                "/api/v1/admin/events/" + eventId + "/check-in-session");
        for (Role role : roles) {
            for (String path : memberPaths) {
                assertThat(getStatus(path, role.session())).as(role.name() + " " + path).isEqualTo(role.memberStatus());
            }
            for (String path : adminPaths) {
                assertThat(getStatus(path, role.session())).as(role.name() + " " + path).isEqualTo(role.adminStatus());
            }
        }
    }

    @Test void publicBoundaryAndAdminWritesRequireAuthenticationAndCsrf() throws Exception {
        assertThat(getStatus("/api/v1/public/events", null)).isEqualTo(404);
        assertThat(getStatus("/api/v1/public/events/1", null)).isEqualTo(401);
        assertThat(getStatus("/api/v1/notices", null)).isEqualTo(401);
        assertThat(getStatus("/api/v1/attendance/me", null)).isEqualTo(401);

        MockHttpSession member = session("APPROVED", "ACTIVE", false);
        MockHttpSession admin = session("APPROVED", "ACTIVE", true);
        String payload = "{\"title\":\"권한 확인\",\"body\":\"본문\",\"published\":false}";
        String memberCsrf = csrf(member);
        String adminCsrf = csrf(admin);
        assertThat(mvc.perform(post("/api/v1/admin/notices").session(member).header("X-CSRF-TOKEN", memberCsrf)
                .contentType("application/json").content(payload)).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(post("/api/v1/admin/notices").session(admin)
                .contentType("application/json").content(payload)).andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(mvc.perform(post("/api/v1/admin/notices").session(admin).header("X-CSRF-TOKEN", adminCsrf)
                .contentType("application/json").content(payload)).andReturn().getResponse().getStatus()).isEqualTo(201);
    }

    @Test void ordinaryMemberCannotApproveCreateEventOrCorrectAttendance() throws Exception {
        MockHttpSession ordinary = session("APPROVED", "ACTIVE", false);
        MockHttpSession admin = session("APPROVED", "ACTIVE", true);
        Member applicant = members.save(new Member(UUID.randomUUID() + "@example.org", "신청자", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVAL_PENDING', email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?", applicant.getId());
        Member target = members.save(new Member(UUID.randomUUID() + "@example.org", "대상자", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = 'ACTIVE', email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?", target.getId());
        long eventId = events.create("정정 대상 행사", "내용", Instant.parse("2026-09-20T09:00:00Z"),
                Instant.parse("2026-09-20T11:00:00Z"), false, false).getId();
        String event = "{\"title\":\"새 행사\",\"description\":\"내용\",\"startAt\":\"2026-09-21T09:00:00Z\","
                + "\"endAt\":\"2026-09-21T11:00:00Z\",\"obEligible\":false,\"publicVisible\":false}";
        for (MockHttpSession role : List.of(ordinary, admin)) {
            int expectedApproval = role == admin ? 204 : 403;
            int expectedCreate = role == admin ? 201 : 403;
            int expectedCorrection = role == admin ? 204 : 403;
            String token = csrf(role);
            assertThat(mvc.perform(post("/api/v1/admin/applications/" + applicant.getId() + "/approve")
                    .session(role).header("X-CSRF-TOKEN", token).contentType("application/json")
                    .content("{\"memberType\":\"ACTIVE\"}")).andReturn().getResponse().getStatus())
                    .isEqualTo(expectedApproval);
            assertThat(mvc.perform(post("/api/v1/admin/events").session(role).header("X-CSRF-TOKEN", token)
                    .contentType("application/json").content(event)).andReturn().getResponse().getStatus())
                    .isEqualTo(expectedCreate);
            assertThat(mvc.perform(put("/api/v1/admin/events/" + eventId + "/attendance/" + target.getId())
                    .session(role).header("X-CSRF-TOKEN", token).contentType("application/json")
                    .content("{\"status\":\"CHECKED_IN\",\"reason\":\"명단 대조\"}"))
                    .andReturn().getResponse().getStatus()).isEqualTo(expectedCorrection);
        }
    }

    private String csrf(MockHttpSession session) throws Exception {
        String body = mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn().getResponse().getContentAsString();
        return body.split("\"token\":\"", 2)[1].split("\"", 2)[0];
    }
}
