package kr.ac.jnu.choir.attendance;

import static org.assertj.core.api.Assertions.assertThat;
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
@Import(CheckInFlowTest.TestConfig.class)
class CheckInFlowTest {
    @TestConfiguration static class TestConfig {
        @Bean @Primary Clock attendanceTestClock() {
            return Clock.fixed(Instant.parse("2026-09-27T10:00:00Z"), ZoneOffset.UTC);
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

    private Member member(String type, boolean admin) {
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
        return mvc.perform(get("/api/v1/auth/csrf").session(session)).andReturn().getResponse()
                .getContentAsString().split("\"token\":\"", 2)[1].split("\"", 2)[0];
    }
    private long event(boolean obEligible) {
        jdbc.update("INSERT INTO event (title,description,start_at,end_at,ob_eligible,public_visible,created_at,updated_at) "
                + "VALUES ('연습','설명','2026-09-27 09:00:00','2026-09-27 12:00:00',?,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))", obEligible);
        return jdbc.queryForObject("SELECT MAX(id) FROM event", Long.class);
    }
    private String open(long eventId, MockHttpSession admin) throws Exception {
        var response = mvc.perform(post("/api/v1/admin/events/" + eventId + "/check-in-session")
                .session(admin).header("X-CSRF-TOKEN", csrf(admin))).andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(201);
        return response.getContentAsString();
    }
    private void close(long eventId, MockHttpSession admin) throws Exception {
        assertThat(mvc.perform(post("/api/v1/admin/events/" + eventId + "/check-in-session/close")
                .session(admin).header("X-CSRF-TOKEN", csrf(admin))).andReturn().getResponse().getStatus()).isEqualTo(204);
    }
    private String own(long eventId, Member member) throws Exception {
        return mvc.perform(get("/api/v1/events/" + eventId + "/attendance/me").session(session(member)))
                .andReturn().getResponse().getContentAsString();
    }
    private String field(String json, String key) {
        return json.split("\"" + key + "\":\"", 2)[1].split("\"", 2)[0];
    }
    private int check(long eventId, MockHttpSession member, String credential) throws Exception {
        long memberId = (Long) member.getAttribute("memberId");
        String address = "10." + ((memberId >> 16) & 255) + "." + ((memberId >> 8) & 255)
                + "." + (memberId & 255);
        return checkFromIp(eventId, member, credential, address);
    }
    private int checkFromIp(long eventId, MockHttpSession member, String credential, String address) throws Exception {
        return mvc.perform(post("/api/v1/events/" + eventId + "/check-ins")
                .with(request -> { request.setRemoteAddr(address); return request; })
                .session(member).header("X-CSRF-TOKEN", csrf(member)).contentType("application/json")
                .content("{\"credential\":\"" + credential + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    @Test void activeMemberChecksInOnceAndMissedAfterClose() throws Exception {
        Member admin = member("ACTIVE", true);
        Member active = member("ACTIVE", false);
        Member missing = member("ACTIVE", false);
        long id = event(false);
        String issued = open(id, session(admin));
        String code = field(issued, "code");
        String availability = mvc.perform(get("/api/v1/events/" + id + "/attendance/me").session(session(active)))
                .andReturn().getResponse().getContentAsString();
        assertThat(availability).contains("\"checkInOpen\":true").doesNotContain(code);
        assertThat(code).hasSize(8);
        assertThat(field(issued, "qrUrl")).startsWith("/events/" + id + "/check-in#token=");
        assertThat(jdbc.queryForObject("SELECT code_hash FROM check_in_session WHERE event_id = ?", String.class, id))
                .doesNotContain(code).hasSize(64);
        assertThat(check(id, session(active), code)).isEqualTo(204);
        assertThat(check(id, session(active), code)).isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance WHERE event_id = ? AND member_id = ?", Long.class,
                id, active.getId())).isEqualTo(1);
        MockHttpSession adminSession = session(admin);
        assertThat(mvc.perform(post("/api/v1/admin/events/" + id + "/check-in-session/close")
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession))).andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(check(id, session(active), code)).isEqualTo(409);
        String own = mvc.perform(get("/api/v1/events/" + id + "/attendance/me").session(session(missing)))
                .andReturn().getResponse().getContentAsString();
        assertThat(own).contains("MISSED");
        assertThat(own).contains("\"checkInOpen\":false");
    }

    @Test void obEligibilityRotationAndCorrectionAreEnforced() throws Exception {
        Member admin = member("ACTIVE", true);
        Member ob = member("OB", false);
        long activeOnly = event(false);
        String oldCode = field(open(activeOnly, session(admin)), "code");
        assertThat(check(activeOnly, session(ob), oldCode)).isEqualTo(403);
        long allowed = event(true);
        String first = open(allowed, session(admin));
        long sessionId = Long.parseLong(first.split("\"sessionId\":", 2)[1].split("[,}]", 2)[0]);
        MockHttpSession adminSession = session(admin);
        var rotated = mvc.perform(post("/api/v1/admin/events/" + allowed + "/check-in-session/" + sessionId + "/rotate")
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession))).andReturn().getResponse();
        assertThat(rotated.getStatus()).isEqualTo(200);
        assertThat(check(allowed, session(ob), field(first, "code"))).isEqualTo(409);
        assertThat(check(allowed, session(ob), field(rotated.getContentAsString(), "code"))).isEqualTo(204);
        var corrected = mvc.perform(put("/api/v1/admin/events/" + allowed + "/attendance/" + ob.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"MISSED\",\"reason\":\"현장 기록 정정\"}"))
                .andReturn().getResponse();
        assertThat(corrected.getStatus()).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_action_log WHERE action = 'ATTENDANCE_CORRECT' "
                + "AND event_id = ? AND target_member_id = ? AND previous_status = 'CHECKED_IN' "
                + "AND new_status = 'MISSED' AND reason = '현장 기록 정정'", Long.class, allowed, ob.getId())).isEqualTo(1);
    }

    @Test void expiredSessionCanBeReopenedButOldCredentialsStayInvalid() throws Exception {
        Member admin = member("ACTIVE", true);
        Member active = member("ACTIVE", false);
        long id = event(false);
        String firstCode = field(open(id, session(admin)), "code");
        jdbc.update("UPDATE check_in_session SET expires_at = '2026-09-27 09:59:59' WHERE event_id = ?", id);
        assertThat(check(id, session(active), firstCode)).isEqualTo(409);
        assertThat(own(id, active)).contains("\"status\":\"MISSED\"", "\"checkInOpen\":false");
        String secondCode = field(open(id, session(admin)), "code");
        assertThat(secondCode).isNotEqualTo(firstCode);
        assertThat(own(id, active)).contains("\"status\":\"NOT_OPEN\"", "\"checkInOpen\":true");
        assertThat(check(id, session(active), firstCode)).isEqualTo(409);
        assertThat(check(id, session(active), secondCode)).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM check_in_session WHERE event_id = ? AND closed_at IS NULL",
                Long.class, id)).isEqualTo(1);
    }

    @Test void accountAndIpAttemptsAreLimitedPerMinute() throws Exception {
        Member admin = member("ACTIVE", true);
        Member active = member("ACTIVE", false);
        long id = event(false);
        open(id, session(admin));
        for (int attempt = 0; attempt < 10; attempt++) {
            assertThat(check(id, session(active), "WRONG123")).isEqualTo(409);
        }
        assertThat(check(id, session(active), "WRONG123")).isEqualTo(429);
    }

    @Test void differentMembersShareTheSameIpLimit() throws Exception {
        Member admin = member("ACTIVE", true);
        long id = event(false);
        open(id, session(admin));
        for (int memberIndex = 0; memberIndex < 10; memberIndex++) {
            Member candidate = member("ACTIVE", false);
            for (int attempt = 0; attempt < 10; attempt++) {
                assertThat(checkFromIp(id, session(candidate), "WRONG123", "192.0.2.85")).isEqualTo(409);
            }
        }
        Member eleventh = member("ACTIVE", false);
        assertThat(checkFromIp(id, session(eleventh), "WRONG123", "192.0.2.85")).isEqualTo(429);
    }

    @Test void qrTokenWorksAndRotationInvalidatesThePreviousToken() throws Exception {
        Member admin = member("ACTIVE", true);
        Member oldTokenMember = member("ACTIVE", false);
        Member newTokenMember = member("ACTIVE", false);
        long id = event(false);
        String first = open(id, session(admin));
        String oldToken = field(first, "qrUrl").split("#token=", 2)[1];
        assertThat(check(id, session(oldTokenMember), oldToken)).isEqualTo(204);
        long sessionId = Long.parseLong(first.split("\"sessionId\":", 2)[1].split("[,}]", 2)[0]);
        MockHttpSession adminSession = session(admin);
        var rotated = mvc.perform(post("/api/v1/admin/events/" + id + "/check-in-session/" + sessionId + "/rotate")
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession))).andReturn().getResponse();
        assertThat(rotated.getStatus()).isEqualTo(200);
        assertThat(check(id, session(newTokenMember), oldToken)).isEqualTo(409);
        String newToken = field(rotated.getContentAsString(), "qrUrl").split("#token=", 2)[1];
        assertThat(check(id, session(newTokenMember), newToken)).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT qr_token_hash FROM check_in_session WHERE id = ?", String.class, sessionId))
                .doesNotContain(newToken).hasSize(64);
    }

    @Test void revokedMemberExistingAttendanceRemainsManageableButCannotCreateAnother() throws Exception {
        Member admin = member("ACTIVE", true);
        Member recorded = member("ACTIVE", false);
        Member unrecorded = member("ACTIVE", false);
        long id = event(false);
        String code = field(open(id, session(admin)), "code");
        assertThat(check(id, session(recorded), code)).isEqualTo(204);
        jdbc.update("UPDATE member SET status = 'REVOKED', auth_version = auth_version + 1 WHERE id IN (?, ?)",
                recorded.getId(), unrecorded.getId());
        String rows = mvc.perform(get("/api/v1/admin/events/" + id + "/attendance").session(session(admin)))
                .andReturn().getResponse().getContentAsString();
        assertThat(rows).contains("\"memberId\":" + recorded.getId(), "\"status\":\"CHECKED_IN\"")
                .containsPattern("\\\"memberId\\\":" + unrecorded.getId() + "[^}]*\\\"status\\\":\\\"NOT_ELIGIBLE\\\"");
        MockHttpSession adminSession = session(admin);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + recorded.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"MISSED\",\"reason\":\"기존 기록 정정\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + unrecorded.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"CHECKED_IN\",\"reason\":\"잘못된 신규 기록\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_action_log WHERE event_id = ? "
                + "AND target_member_id = ? AND previous_status = 'CHECKED_IN' AND new_status = 'MISSED' "
                + "AND reason = '기존 기록 정정'", Long.class, id, recorded.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance WHERE event_id = ? AND member_id = ?",
                Long.class, id, unrecorded.getId())).isZero();
    }

    @Test void changedObEligibilityCannotHideOrBlockExistingRecord() throws Exception {
        Member admin = member("ACTIVE", true);
        Member recorded = member("OB", false);
        Member unrecorded = member("OB", false);
        long id = event(true);
        String code = field(open(id, session(admin)), "code");
        assertThat(check(id, session(recorded), code)).isEqualTo(204);
        jdbc.update("UPDATE event SET ob_eligible = FALSE WHERE id = ?", id);
        String own = mvc.perform(get("/api/v1/events/" + id + "/attendance/me").session(session(recorded)))
                .andReturn().getResponse().getContentAsString();
        assertThat(own).contains("CHECKED_IN");
        assertThat(check(id, session(unrecorded), code)).isEqualTo(403);
        String rows = mvc.perform(get("/api/v1/admin/events/" + id + "/attendance").session(session(admin)))
                .andReturn().getResponse().getContentAsString();
        assertThat(rows).contains("\"memberId\":" + recorded.getId(), "\"status\":\"CHECKED_IN\"")
                .containsPattern("\\\"memberId\\\":" + unrecorded.getId() + "[^}]*\\\"status\\\":\\\"NOT_ELIGIBLE\\\"");
        MockHttpSession adminSession = session(admin);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + recorded.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"MISSED\",\"reason\":\"대상 변경 후 정정\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + unrecorded.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"MISSED\",\"reason\":\"대상 아님\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_action_log WHERE event_id = ? "
                + "AND target_member_id = ? AND previous_status = 'CHECKED_IN' AND new_status = 'MISSED' "
                + "AND reason = '대상 변경 후 정정'", Long.class, id, recorded.getId())).isEqualTo(1);
    }

    @Test void historicalMissedSurvivesAccessRevocationAndCanBeCorrected() throws Exception {
        Member admin = member("ACTIVE", true);
        Member historical = member("ACTIVE", false);
        long id = event(false);
        open(id, session(admin));
        close(id, session(admin));
        jdbc.update("UPDATE member SET status = 'REVOKED', auth_version = auth_version + 1 WHERE id = ?", historical.getId());

        String rows = mvc.perform(get("/api/v1/admin/events/" + id + "/attendance").session(session(admin)))
                .andReturn().getResponse().getContentAsString();
        assertThat(rows).containsPattern("\\\"memberId\\\":" + historical.getId() + "[^}]*\\\"status\\\":\\\"MISSED\\\"");
        MockHttpSession adminSession = session(admin);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + historical.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"CHECKED_IN\",\"reason\":\"종료 당시 대상 정정\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_action_log WHERE event_id = ? AND target_member_id = ? "
                + "AND previous_status = 'MISSED' AND new_status = 'CHECKED_IN' AND reason = '종료 당시 대상 정정'",
                Long.class, id, historical.getId())).isEqualTo(1);
    }

    @Test void historicalObMissedSurvivesEligibilityChange() throws Exception {
        Member admin = member("ACTIVE", true);
        Member historical = member("OB", false);
        long id = event(true);
        open(id, session(admin));
        close(id, session(admin));
        jdbc.update("UPDATE event SET ob_eligible = FALSE WHERE id = ?", id);

        assertThat(own(id, historical)).contains("\"status\":\"MISSED\"");
        String rows = mvc.perform(get("/api/v1/admin/events/" + id + "/attendance").session(session(admin)))
                .andReturn().getResponse().getContentAsString();
        assertThat(rows).containsPattern("\\\"memberId\\\":" + historical.getId() + "[^}]*\\\"status\\\":\\\"MISSED\\\"");
        MockHttpSession adminSession = session(admin);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + historical.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"CHECKED_IN\",\"reason\":\"당시 OB 대상 정정\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_action_log WHERE event_id = ? AND target_member_id = ? "
                + "AND previous_status = 'MISSED' AND new_status = 'CHECKED_IN' AND reason = '당시 OB 대상 정정'",
                Long.class, id, historical.getId())).isEqualTo(1);
    }

    @Test void approvalAfterOpeningDoesNotCreateEarlierAbsenceButCanCheckIn() throws Exception {
        Member admin = member("ACTIVE", true);
        Member lateAbsent = member("ACTIVE", false);
        Member latePresent = member("ACTIVE", false);
        jdbc.update("UPDATE member SET status = 'APPROVAL_PENDING' WHERE id IN (?, ?)", lateAbsent.getId(), latePresent.getId());
        long id = event(false);
        String issued = open(id, session(admin));
        long sessionId = Long.parseLong(issued.split("\"sessionId\":", 2)[1].split("[,}]", 2)[0]);
        jdbc.update("UPDATE member SET status = 'APPROVED' WHERE id IN (?, ?)", lateAbsent.getId(), latePresent.getId());

        assertThat(own(id, lateAbsent)).contains("\"status\":\"NOT_OPEN\"", "\"checkInOpen\":true");
        assertThat(check(id, session(latePresent), field(issued, "code"))).isEqualTo(204);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot "
                + "WHERE check_in_session_id = ? AND member_id = ?", Long.class, sessionId, latePresent.getId())).isEqualTo(1);
        close(id, session(admin));
        assertThat(own(id, lateAbsent)).contains("\"status\":\"NOT_OPEN\"").doesNotContain("MISSED");
        assertThat(own(id, latePresent)).contains("\"status\":\"CHECKED_IN\"");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot "
                + "WHERE check_in_session_id = ? AND member_id = ?", Long.class, sessionId, lateAbsent.getId())).isZero();
        jdbc.update("UPDATE member SET status = 'REVOKED', auth_version = auth_version + 1 WHERE id = ?", lateAbsent.getId());
        MockHttpSession adminSession = session(admin);
        assertThat(mvc.perform(put("/api/v1/admin/events/" + id + "/attendance/" + lateAbsent.getId())
                .session(adminSession).header("X-CSRF-TOKEN", csrf(adminSession)).contentType("application/json")
                .content("{\"status\":\"CHECKED_IN\",\"reason\":\"과거 대상 아님\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(403);
    }

    @Test void reopeningSnapshotsCurrentTargetsAndKeepsOlderTargets() throws Exception {
        Member admin = member("ACTIVE", true);
        Member older = member("ACTIVE", false);
        Member removed = member("ACTIVE", false);
        long id = event(false);
        String first = open(id, session(admin));
        long firstId = Long.parseLong(first.split("\"sessionId\":", 2)[1].split("[,}]", 2)[0]);
        close(id, session(admin));
        Member newcomer = member("ACTIVE", false);
        jdbc.update("UPDATE member SET status = 'REVOKED', auth_version = auth_version + 1 WHERE id = ?", removed.getId());
        String second = open(id, session(admin));
        long secondId = Long.parseLong(second.split("\"sessionId\":", 2)[1].split("[,}]", 2)[0]);

        assertThat(own(id, older)).contains("\"status\":\"NOT_OPEN\"", "\"checkInOpen\":true");
        assertThat(own(id, newcomer)).contains("\"status\":\"NOT_OPEN\"", "\"checkInOpen\":true");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot "
                + "WHERE check_in_session_id = ? AND member_id = ?", Long.class, firstId, newcomer.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot "
                + "WHERE check_in_session_id = ? AND member_id = ?", Long.class, secondId, newcomer.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot "
                + "WHERE member_id = ? AND check_in_session_id IN (?, ?)", Long.class, older.getId(), firstId, secondId)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attendance_eligibility_snapshot "
                + "WHERE member_id = ? AND check_in_session_id IN (?, ?)", Long.class, removed.getId(), firstId, secondId)).isEqualTo(1);
        String rows = mvc.perform(get("/api/v1/admin/events/" + id + "/attendance").session(session(admin)))
                .andReturn().getResponse().getContentAsString();
        assertThat(rows).containsPattern("\\\"memberId\\\":" + removed.getId() + "[^}]*\\\"status\\\":\\\"MISSED\\\"");
        assertThat(check(id, session(older), field(second, "code"))).isEqualTo(204);
        close(id, session(admin));
        assertThat(own(id, newcomer)).contains("\"status\":\"MISSED\"");
    }

    private String myList(Member member) throws Exception {
        return mvc.perform(get("/api/v1/attendance/me").session(session(member))).andReturn().getResponse().getContentAsString();
    }

    @Test void obAttendanceListShowsOnlyEligibleEventsAndKeepsEarnedRecords() throws Exception {
        Member admin = member("ACTIVE", true);
        Member active = member("ACTIVE", false);
        Member ob = member("OB", false);
        long practice = event(false);
        long concert = event(true);
        long formerConcert = event(true);
        String code = field(open(formerConcert, session(admin)), "code");
        assertThat(check(formerConcert, session(ob), code)).isEqualTo(204);
        jdbc.update("UPDATE event SET ob_eligible = FALSE WHERE id = ?", formerConcert);

        assertThat(myList(ob)).contains("\"eventId\":" + concert + ",", "\"eventId\":" + formerConcert + ",")
                .doesNotContain("\"eventId\":" + practice + ",", "NOT_ELIGIBLE");
        assertThat(myList(active)).contains("\"eventId\":" + practice + ",", "\"eventId\":" + concert + ",",
                "\"eventId\":" + formerConcert + ",");
    }

    @Test void attendanceListShowsStartedEventsNewestFirst() throws Exception {
        Member active = member("ACTIVE", false);
        long recent = event(false);
        jdbc.update("INSERT INTO event (title,description,start_at,end_at,ob_eligible,public_visible,created_at,updated_at) "
                + "VALUES ('지난주 연습','설명','2026-09-20 09:00:00','2026-09-20 12:00:00',FALSE,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)), "
                + "('저녁 연습','설명','2026-09-27 13:00:00','2026-09-27 15:00:00',FALSE,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)), "
                + "('다음 주 연습','설명','2026-10-04 09:00:00','2026-10-04 12:00:00',FALSE,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))");

        String list = myList(active);
        assertThat(list).contains("지난주 연습", "\"startAt\":\"2026-09-20T09:00:00Z\"").doesNotContain("저녁 연습", "다음 주 연습");
        assertThat(list.indexOf("\"eventId\":" + recent + ",")).isNotNegative().isLessThan(list.indexOf("지난주 연습"));
    }
}
