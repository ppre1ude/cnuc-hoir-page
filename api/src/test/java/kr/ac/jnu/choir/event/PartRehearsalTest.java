package kr.ac.jnu.choir.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
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
import org.springframework.dao.DataIntegrityViolationException;
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

// 파트연습의 종류·파트 규칙, 권한, 노출, 참석 응답과 출석 대상을 실제 DB로 확인합니다.
@SpringBootTest
@Testcontainers
@Import(PartRehearsalTest.TestConfig.class)
class PartRehearsalTest {
    // 한국 시간 2026-10-27 18:00입니다. 앞으로 열릴 일정과 진행 중인 일정을 나눠 씁니다.
    static final Instant NOW = Instant.parse("2026-10-27T09:00:00Z");
    static final String UPCOMING_START = "2026-10-27T10:30:00Z";
    static final String UPCOMING_END = "2026-10-27T12:30:00Z";

    @TestConfiguration static class TestConfig {
        @Bean @Primary Clock partRehearsalTestClock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }
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
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();
    }

    // 파트를 지정한 승인 단원입니다. part가 null이면 파트 미지정입니다.
    private Member member(String type, String part) {
        Member member = members.save(new Member(UUID.randomUUID() + "@example.org", "단원", "{noop}password", Clock.systemUTC()));
        jdbc.update("UPDATE member SET status = 'APPROVED', member_type = ?, part = ?, email_verified_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                type, part, member.getId());
        return members.findById(member.getId()).orElseThrow();
    }

    private Member siteAdmin() {
        Member admin = member("ACTIVE", null);
        jdbc.update("UPDATE member SET admin = TRUE WHERE id = ?", admin.getId());
        return members.findById(admin.getId()).orElseThrow();
    }

    // 직책을 DB에 직접 넣은 활동 단원입니다. 수석이면 rolePart에 수석 파트를 줍니다.
    private Member staff(String role, String memberPart, String rolePart) {
        Member member = member("ACTIVE", memberPart);
        jdbc.update("INSERT INTO member_role (member_id, role, part, assigned_by_member_id, assigned_at) "
                + "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(6))", member.getId(), role, rolePart, member.getId());
        return member;
    }

    private MockHttpSession session(Member member) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("memberId", member.getId());
        session.setAttribute("authVersion", member.getAuthVersion());
        return session;
    }

    private String csrf(MockHttpSession session) throws Exception {
        return mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn().getResponse()
                .getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
    }

    private MockHttpServletResponse write(Member actor, MockHttpServletRequestBuilder request, String body) throws Exception {
        MockHttpSession session = session(actor);
        return mvc.perform(request.session(session).header("X-CSRF-TOKEN", csrf(session))
                .contentType("application/json").content(body)).andReturn().getResponse();
    }

    private MockHttpServletResponse read(Member actor, String path) throws Exception {
        return mvc.perform(get(path).session(session(actor))).andReturn().getResponse();
    }

    private static String input(String title, String kind, String part, boolean ob) {
        return input(title, kind, part, ob, UPCOMING_START, UPCOMING_END);
    }

    private static String input(String title, String kind, String part, boolean ob, String start, String end) {
        return "{\"title\":\"" + title + "\",\"description\":\"\",\"startAt\":\"" + start + "\",\"endAt\":\""
                + end + "\",\"kind\":\"" + kind + "\",\"part\":" + (part == null ? "null" : "\"" + part + "\"")
                + ",\"obEligible\":" + ob + ",\"publicVisible\":false}";
    }

    private static long id(MockHttpServletResponse response) throws Exception {
        return Long.parseLong(response.getContentAsString().split("\"id\":", 2)[1].split("[,}]", 2)[0]);
    }

    private long create(Member actor, String body) throws Exception {
        var response = write(actor, post("/api/v1/admin/events"), body);
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(201);
        return id(response);
    }

    private static String unique(String title) {
        return title + " " + UUID.randomUUID().toString().substring(0, 8);
    }

    // 하루 안의 일정 목록입니다.
    private String list(Member member) throws Exception {
        var response = read(member, "/api/v1/events?from=2026-10-27T00:00:00Z&to=2026-10-28T00:00:00Z");
        assertThat(response.getStatus()).isEqualTo(200);
        return response.getContentAsString();
    }

    @Test void partRuleIsCheckedByApiAndDatabase() throws Exception {
        Member admin = siteAdmin();
        var noPart = write(admin, post("/api/v1/admin/events"), input("파트 없는 파트연습", "PART_REHEARSAL", null, false));
        assertThat(noPart.getStatus()).isEqualTo(400);
        assertThat(noPart.getContentAsString()).contains("INVALID_EVENT_PART");
        assertThat(write(admin, post("/api/v1/admin/events"), input("파트 있는 행사", "EVENT", "TENOR", false))
                .getStatus()).isEqualTo(400);
        assertThat(write(admin, post("/api/v1/admin/events"), input("파트 있는 전체연습", "REGULAR_REHEARSAL", "TENOR", false))
                .getStatus()).isEqualTo(400);
        assertThat(write(admin, post("/api/v1/admin/events"), "{\"title\":\"종류 없음\",\"description\":\"\",\"startAt\":\""
                + UPCOMING_START + "\",\"endAt\":\"" + UPCOMING_END + "\",\"obEligible\":false,\"publicVisible\":false}")
                .getStatus()).isEqualTo(400);
        var created = write(admin, post("/api/v1/admin/events"), input("테너 파트연습", "PART_REHEARSAL", "TENOR", false));
        assertThat(created.getStatus()).isEqualTo(201);
        assertThat(created.getContentAsString()).contains("\"kind\":\"PART_REHEARSAL\"", "\"part\":\"TENOR\"");

        String insert = "INSERT INTO event (title,description,start_at,end_at,kind,part,ob_eligible,public_visible,created_at,updated_at) "
                + "VALUES ('직접','','2026-10-27 10:30:00','2026-10-27 12:30:00',?,?,FALSE,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))";
        assertThatThrownBy(() -> jdbc.update(insert, "EVENT", "TENOR")).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, "PART_REHEARSAL", null)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, "PART_REHEARSAL", "CHOIR")).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, "CONCERT", null)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(insert, "FULL_REHEARSAL", null)).isInstanceOf(DataIntegrityViolationException.class);
    }

    // 정기와 비정기로 나뉘기 전의 값입니다. 배포 중 옛 화면이 보내면 거절합니다.
    @Test void oldFullRehearsalKindIsRejected() throws Exception {
        assertThat(write(siteAdmin(), post("/api/v1/admin/events"), input(unique("전체연습"), "FULL_REHEARSAL", null, false))
                .getStatus()).isEqualTo(400);
    }

    @Test void operatorsCreateAndChangeOnlyKindsAndPartsTheyManage() throws Exception {
        Member tenorLead = staff("SECTION_LEAD", "TENOR", "TENOR");
        Member vice = staff("VICE_PRESIDENT", "SOPRANO", null);
        Member treasurer = staff("TREASURER", "BASS", null);
        var post = post("/api/v1/admin/events");
        long tenorRehearsal = create(tenorLead, input(unique("테너 파트연습"), "PART_REHEARSAL", "TENOR", false));
        assertThat(write(tenorLead, post("/api/v1/admin/events"), input(unique("소프라노 파트연습"), "PART_REHEARSAL", "SOPRANO", false))
                .getStatus()).isEqualTo(403);
        assertThat(write(tenorLead, post, input(unique("전체연습"), "REGULAR_REHEARSAL", null, false)).getStatus()).isEqualTo(403);
        create(tenorLead, input(unique("테너 회식"), "EVENT", null, false));
        long sopranoRehearsal = create(vice, input(unique("소프라노 파트연습"), "PART_REHEARSAL", "SOPRANO", false));
        create(vice, input(unique("전체연습"), "REGULAR_REHEARSAL", null, false));
        assertThat(write(tenorLead, post, input(unique("비정기연습"), "EXTRA_REHEARSAL", null, false)).getStatus()).isEqualTo(403);
        create(vice, input(unique("비정기연습"), "EXTRA_REHEARSAL", null, false));
        assertThat(write(treasurer, post("/api/v1/admin/events"), input(unique("전체연습"), "REGULAR_REHEARSAL", null, false))
                .getStatus()).isEqualTo(403);
        assertThat(write(treasurer, post("/api/v1/admin/events"), input(unique("테너 파트연습"), "PART_REHEARSAL", "TENOR", false))
                .getStatus()).isEqualTo(403);
        create(treasurer, input(unique("정기 총회"), "EVENT", null, false));

        String path = "/api/v1/admin/events/" + tenorRehearsal;
        assertThat(write(tenorLead, put(path), input("테너 파트연습 수정", "PART_REHEARSAL", "TENOR", false)).getStatus()).isEqualTo(200);
        assertThat(write(tenorLead, put(path), input("전체연습으로", "REGULAR_REHEARSAL", null, false)).getStatus()).isEqualTo(403);
        assertThat(write(tenorLead, put(path), input("소프라노로", "PART_REHEARSAL", "SOPRANO", false)).getStatus()).isEqualTo(403);
        assertThat(write(tenorLead, put("/api/v1/admin/events/" + sopranoRehearsal),
                input("남의 파트", "PART_REHEARSAL", "TENOR", false)).getStatus()).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT title FROM event WHERE id = ?", String.class, tenorRehearsal))
                .isEqualTo("테너 파트연습 수정");

        String mixed = unique("섞인 일괄 등록");
        var batch = write(tenorLead, post("/api/v1/admin/events/batch"), "{\"events\":["
                + input(mixed, "PART_REHEARSAL", "TENOR", false) + ","
                + input(mixed, "PART_REHEARSAL", "SOPRANO", false, "2026-10-28T10:30:00Z", "2026-10-28T12:30:00Z") + "]}");
        assertThat(batch.getStatus()).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM event WHERE title = ?", Long.class, mixed)).isZero();
    }

    @Test void partRehearsalIsListedOnlyForThatPartAndOperators() throws Exception {
        Member admin = siteAdmin();
        String title = unique("테너 파트연습");
        String obTitle = unique("테너 OB 파트연습");
        long id = create(admin, input(title, "PART_REHEARSAL", "TENOR", false));
        create(admin, input(obTitle, "PART_REHEARSAL", "TENOR", true));
        Member tenor = member("ACTIVE", "TENOR");
        Member soprano = member("ACTIVE", "SOPRANO");
        Member noPart = member("ACTIVE", null);
        Member tenorOb = member("OB", "TENOR");
        Member treasurer = staff("TREASURER", "BASS", null);
        Member sopranoLead = staff("SECTION_LEAD", "SOPRANO", "SOPRANO");

        assertThat(list(tenor)).contains(title, obTitle);
        assertThat(list(treasurer)).contains(title, obTitle);
        assertThat(list(sopranoLead)).contains(title, obTitle);
        assertThat(list(admin)).contains(title, obTitle);
        assertThat(list(soprano)).doesNotContain(title, obTitle);
        assertThat(list(noPart)).doesNotContain(title, obTitle);
        assertThat(list(tenorOb)).contains(obTitle).doesNotContain(title);

        assertThat(read(tenor, "/api/v1/events/" + id).getStatus()).isEqualTo(200);
        assertThat(read(treasurer, "/api/v1/events/" + id).getStatus()).isEqualTo(200);
        var hidden = read(soprano, "/api/v1/events/" + id);
        assertThat(hidden.getStatus()).isEqualTo(404);
        assertThat(hidden.getContentAsString()).contains("EVENT_NOT_FOUND").doesNotContain(title);
    }

    @Test void onlyThatPartRespondsAndRosterCountsThatPart() throws Exception {
        Member admin = siteAdmin();
        long id = create(admin, input(unique("테너 파트연습"), "PART_REHEARSAL", "TENOR", false));
        Member tenor = member("ACTIVE", "TENOR");
        Member soprano = member("ACTIVE", "SOPRANO");
        Member treasurer = staff("TREASURER", "BASS", null);
        String attend = "{\"choice\":\"ATTENDING\"}";
        String rsvp = "/api/v1/events/" + id + "/rsvp";
        assertThat(write(tenor, put(rsvp), attend).getStatus()).isEqualTo(200);
        var refused = write(soprano, put(rsvp), attend);
        assertThat(refused.getStatus()).isEqualTo(403);
        assertThat(refused.getContentAsString()).contains("EVENT_NOT_ELIGIBLE");
        assertThat(write(treasurer, put(rsvp), attend).getStatus()).isEqualTo(403);
        assertThat(read(soprano, rsvp).getContentAsString()).contains("\"choice\":null");
        assertThat(read(tenor, "/api/v1/events/rsvps/me?from=2026-10-27T00:00:00Z&to=2026-10-28T00:00:00Z")
                .getContentAsString()).contains("\"eventId\":" + id);

        // 응답이 남은 일정을 행사에서 파트연습으로 바꾸면 다른 파트 단원의 응답은 집계와 내 응답에서 빠집니다.
        long changed = create(admin, input(unique("행사였던 일정"), "EVENT", null, false));
        assertThat(write(soprano, put("/api/v1/events/" + changed + "/rsvp"), attend).getStatus()).isEqualTo(200);
        assertThat(write(admin, put("/api/v1/admin/events/" + changed), input(unique("테너 파트연습"), "PART_REHEARSAL", "TENOR", false))
                .getStatus()).isEqualTo(200);
        assertThat(read(soprano, "/api/v1/events/rsvps/me?from=2026-10-27T00:00:00Z&to=2026-10-28T00:00:00Z")
                .getContentAsString()).doesNotContain("\"eventId\":" + changed);
        assertThat(read(admin, "/api/v1/admin/events/" + changed + "/rsvps").getContentAsString())
                .doesNotContain("\"memberId\":" + soprano.getId() + ",");

        String roster = "/api/v1/admin/events/" + id + "/rsvps";
        var rows = read(staff("SECTION_LEAD", "TENOR", "TENOR"), roster);
        assertThat(rows.getStatus()).isEqualTo(200);
        assertThat(rows.getContentAsString()).contains("\"memberId\":" + tenor.getId() + ",", "\"choice\":\"ATTENDING\"")
                .doesNotContain("\"memberId\":" + soprano.getId() + ",", "\"part\":\"SOPRANO\"", "\"part\":\"BASS\"",
                        "\"part\":null");
        assertThat(read(staff("VICE_PRESIDENT", "ALTO", null), roster).getStatus()).isEqualTo(200);
        assertThat(read(treasurer, roster).getStatus()).isEqualTo(200);
        assertThat(read(admin, roster).getStatus()).isEqualTo(200);
        assertThat(read(staff("SECTION_LEAD", "SOPRANO", "SOPRANO"), roster).getStatus()).isEqualTo(403);
        assertThat(read(staff("DEPARTMENT_HEAD", "TENOR", null), roster).getStatus()).isEqualTo(403);
        assertThat(read(tenor, roster).getStatus()).isEqualTo(403);
    }

    @Test void attendanceWindowTargetsOnlyThatPart() throws Exception {
        Member admin = siteAdmin();
        Member tenorLead = staff("SECTION_LEAD", "TENOR", "TENOR");
        // 지금(18:00) 진행 중인 파트연습입니다.
        long id = create(tenorLead, input(unique("테너 파트연습"), "PART_REHEARSAL", "TENOR", false,
                "2026-10-27T08:30:00Z", "2026-10-27T10:30:00Z"));
        Member tenor = member("ACTIVE", "TENOR");
        Member lateTenor = member("ACTIVE", "TENOR");
        Member soprano = member("ACTIVE", "SOPRANO");
        Member treasurer = staff("TREASURER", "BASS", null);
        Member sopranoLead = staff("SECTION_LEAD", "SOPRANO", "SOPRANO");
        Member head = staff("DEPARTMENT_HEAD", "ALTO", null);
        String window = "/api/v1/admin/events/" + id + "/check-in-session";

        assertThat(write(sopranoLead, post(window), "").getStatus()).isEqualTo(403);
        assertThat(write(head, post(window), "").getStatus()).isEqualTo(403);
        var opened = write(tenorLead, post(window), "");
        assertThat(opened.getStatus()).isEqualTo(201);
        String code = opened.getContentAsString().split("\"code\":\"", 2)[1].split("\"", 2)[0];

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot snap "
                + "JOIN check_in_session sess ON sess.id = snap.check_in_session_id JOIN member m ON m.id = snap.member_id "
                + "WHERE sess.event_id = ? AND (m.part IS NULL OR m.part <> 'TENOR')", Long.class, id)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot snap "
                + "JOIN check_in_session sess ON sess.id = snap.check_in_session_id "
                + "WHERE sess.event_id = ? AND snap.member_id IN (?, ?)", Long.class, id, tenor.getId(), lateTenor.getId()))
                .isEqualTo(2);

        String credential = "{\"credential\":\"" + code + "\"}";
        var refused = write(soprano, post("/api/v1/events/" + id + "/check-ins"), credential);
        assertThat(refused.getStatus()).isEqualTo(403);
        assertThat(refused.getContentAsString()).contains("NOT_ELIGIBLE");
        assertThat(write(tenor, post("/api/v1/events/" + id + "/check-ins"), credential).getStatus()).isEqualTo(204);

        var rows = read(treasurer, "/api/v1/admin/events/" + id + "/attendance");
        assertThat(rows.getStatus()).isEqualTo(200);
        assertThat(rows.getContentAsString()).contains("\"memberId\":" + tenor.getId() + ",", "\"memberId\":" + lateTenor.getId() + ",")
                .doesNotContain("\"memberId\":" + soprano.getId() + ",", "\"part\":\"SOPRANO\"");
        assertThat(read(sopranoLead, "/api/v1/admin/events/" + id + "/attendance").getStatus()).isEqualTo(403);
        assertThat(write(treasurer, post(window + "/close"), "").getStatus()).isEqualTo(204);

        assertThat(read(soprano, "/api/v1/attendance/me").getContentAsString()).doesNotContain("\"eventId\":" + id + ",");
        assertThat(read(lateTenor, "/api/v1/attendance/me").getContentAsString())
                .contains("\"eventId\":" + id + ",").contains("\"status\":\"MISSED\"");
        String correction = "{\"status\":\"CHECKED_IN\",\"reason\":\"늦게 도착\"}";
        String correct = "/api/v1/admin/events/" + id + "/attendance/" + lateTenor.getId();
        assertThat(write(sopranoLead, put(correct), correction).getStatus()).isEqualTo(403);
        assertThat(write(admin, put(correct), correction).getStatus()).isEqualTo(204);
    }
}
