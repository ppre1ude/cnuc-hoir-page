package kr.ac.jnu.choir.attendance;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Member;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CheckInService {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public CheckInService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public IssuedSession open(long eventId) {
        EventRow event = lockEvent(eventId);
        Instant now = clock.instant();
        List<SessionRow> active = activeSession(eventId);
        if (!active.isEmpty()) {
            if (now.isBefore(active.getFirst().expiresAt())) {
                throw conflict("SESSION_ALREADY_OPEN", "이미 열린 출석 창이 있습니다.");
            }
            jdbc.update("UPDATE check_in_session SET closed_at = ? WHERE id = ?", time(now), active.getFirst().id());
        }
        String qrToken = newQrToken();
        String code = newCode();
        Instant expiresAt = now.plus(Duration.ofMinutes(10));
        Long id = jdbc.queryForObject("INSERT INTO check_in_session (event_id,opened_at,expires_at,qr_token_hash,code_hash) "
                + "VALUES (?,?,?,?,?) RETURNING id", Long.class,
                eventId, time(now), time(expiresAt), hash(qrToken), hash(code));
        jdbc.update("INSERT INTO attendance_eligibility_snapshot (check_in_session_id,member_id,snapshotted_at) "
                + "SELECT ?,m.id,? FROM member m WHERE m.status = 'APPROVED' "
                + "AND (m.member_type = 'ACTIVE' OR (? AND m.member_type = 'OB'))",
                id, time(now), event.obEligible());
        return new IssuedSession(id, expiresAt, "/events/" + eventId + "/check-in#token=" + qrToken, code);
    }

    @Transactional
    public IssuedSession rotate(long eventId, long sessionId) {
        lockEvent(eventId);
        SessionRow session = currentSession(eventId, sessionId);
        if (session.closedAt() != null || !clock.instant().isBefore(session.expiresAt())) {
            throw conflict("SESSION_CLOSED", "출석 창이 닫혔거나 만료되었습니다.");
        }
        String qrToken = newQrToken();
        String code = newCode();
        jdbc.update("UPDATE check_in_session SET qr_token_hash = ?, code_hash = ? WHERE id = ?",
                hash(qrToken), hash(code), sessionId);
        return new IssuedSession(sessionId, session.expiresAt(), "/events/" + eventId + "/check-in#token=" + qrToken, code);
    }

    @Transactional
    public void close(long eventId) {
        lockEvent(eventId);
        List<SessionRow> active = activeSession(eventId);
        if (active.isEmpty()) throw conflict("SESSION_CLOSED", "열린 출석 창이 없습니다.");
        jdbc.update("UPDATE check_in_session SET closed_at = ? WHERE id = ?", time(clock.instant()), active.getFirst().id());
    }

    @Transactional
    public void checkIn(long eventId, Member member, String credential) {
        EventRow event = lockEvent(eventId);
        MemberRow target = lockMember(member.getId());
        if (!eligible(event, target)) throw forbidden();
        if (attendance(eventId, member.getId()) != null) {
            throw conflict("ALREADY_CHECKED_IN", "이미 처리된 출석입니다.");
        }
        List<SessionRow> active = activeSession(eventId);
        if (active.isEmpty() || !clock.instant().isBefore(active.getFirst().expiresAt())) {
            throw conflict("SESSION_CLOSED", "출석 창이 닫혔거나 만료되었습니다.");
        }
        SessionRow session = active.getFirst();
        boolean valid = constantTimeEquals(session.qrHash(), hash(credential))
                | constantTimeEquals(session.codeHash(), hash(credential));
        if (!valid) throw conflict("INVALID_CREDENTIAL", "출석 코드가 유효하지 않습니다.");
        try {
            jdbc.update("INSERT INTO attendance (event_id,member_id,status,checked_in_at) VALUES (?,?,'CHECKED_IN',?)",
                    eventId, member.getId(), time(clock.instant()));
            jdbc.update("INSERT INTO attendance_eligibility_snapshot (check_in_session_id,member_id,snapshotted_at) "
                    + "SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM attendance_eligibility_snapshot "
                    + "WHERE check_in_session_id = ? AND member_id = ?)",
                    session.id(), member.getId(), time(clock.instant()), session.id(), member.getId());
        } catch (DuplicateKeyException duplicate) {
            throw conflict("ALREADY_CHECKED_IN", "이미 처리된 출석입니다.");
        }
    }

    @Transactional(readOnly = true)
    public AttendanceState mine(long eventId, Member member) {
        EventRow event = findEvent(eventId);
        MemberRow target = memberRow(member.getId());
        return state(event, target);
    }

    @Transactional(readOnly = true)
    public List<AttendanceState> myList(Member member) {
        MemberRow target = memberRow(member.getId());
        // ob_eligible로 거르지 않고 계산된 상태로 거릅니다. 활동 단원 시절에 남은 출석·미출석 기록을 OB가 된 뒤에도 보여야 합니다.
        return jdbc.query("SELECT id,title,ob_eligible,start_at FROM event WHERE start_at <= ? ORDER BY start_at DESC,id DESC", (rs, row) ->
                state(new EventRow(rs.getLong(1), rs.getString(2), rs.getBoolean(3), eventTime(rs)), target),
                // event 시각은 UTC 기준 TIMESTAMP라 JVM 시간대를 타는 Timestamp 대신 UTC LocalDateTime으로 비교합니다.
                LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC))
                .stream().filter(state -> !"NOT_ELIGIBLE".equals(state.status())).toList();
    }

    @Transactional(readOnly = true)
    public List<AdminAttendance> adminList(long eventId) {
        EventRow event = findEvent(eventId);
        return jdbc.query("SELECT id,name,status,member_type,part,cohort FROM member WHERE "
                + "(status = 'APPROVED' AND (member_type = 'ACTIVE' OR (? AND member_type = 'OB'))) "
                + "OR EXISTS (SELECT 1 FROM attendance a WHERE a.event_id = ? AND a.member_id = member.id) "
                + "OR EXISTS (SELECT 1 FROM attendance_eligibility_snapshot snap "
                + "JOIN check_in_session sess ON sess.id = snap.check_in_session_id "
                + "WHERE sess.event_id = ? AND snap.member_id = member.id) "
                + "ORDER BY name,id",
                (rs, row) -> {
                    MemberRow target = new MemberRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4));
                    return new AdminAttendance(target.id(), target.name(), rs.getString(5),
                            rs.getObject(6, Integer.class), state(event, target).status());
                }, event.obEligible(), eventId, eventId);
    }

    @Transactional(readOnly = true)
    public SessionStatus sessionStatus(long eventId) {
        findEvent(eventId);
        List<SessionRow> active = activeSession(eventId);
        if (active.isEmpty()) return new SessionStatus(null, null, false);
        SessionRow session = active.getFirst();
        return new SessionStatus(session.id(), session.expiresAt(), clock.instant().isBefore(session.expiresAt()));
    }

    @Transactional
    public void correct(long eventId, long memberId, Member actor, String newStatus, String reason) {
        EventRow event = lockEvent(eventId);
        MemberRow target = lockMember(memberId);
        if (attendance(eventId, memberId) == null && !eligible(event, target)
                && !historicalMissed(eventId, memberId)) throw forbidden();
        AttendanceState previous = state(event, target);
        if (newStatus.equals(previous.status())) {
            throw conflict("ATTENDANCE_UNCHANGED", "출석 상태가 이미 같습니다.");
        }
        Instant now = clock.instant();
        if (attendance(eventId, memberId) == null) {
            jdbc.update("INSERT INTO attendance (event_id,member_id,status,checked_in_at,corrected_at) VALUES (?,?,?,?,?)",
                    eventId, memberId, newStatus, newStatus.equals("CHECKED_IN") ? time(now) : null, time(now));
        } else {
            jdbc.update("UPDATE attendance SET status = ?, checked_in_at = ?, corrected_at = ? WHERE event_id = ? AND member_id = ?",
                    newStatus, newStatus.equals("CHECKED_IN") ? time(now) : null, time(now), eventId, memberId);
        }
        jdbc.update("INSERT INTO admin_action_log (actor_member_id,target_member_id,action,previous_status,new_status,reason,acted_at,event_id) "
                + "VALUES (?,?,'ATTENDANCE_CORRECT',?,?,?,?,?)", actor.getId(), memberId, previous.status(),
                newStatus, reason.strip(), time(now), eventId);
    }

    private AttendanceState state(EventRow event, MemberRow target) {
        String stored = attendance(event.id(), target.id());
        if (stored != null) return new AttendanceState(event.id(), event.title(), event.startAt(), stored, false);
        boolean eligibleNow = eligible(event, target);
        List<SessionRow> active = activeSession(event.id());
        boolean open = !active.isEmpty() && clock.instant().isBefore(active.getFirst().expiresAt());
        if (open && eligibleNow) return new AttendanceState(event.id(), event.title(), event.startAt(), "NOT_OPEN", true);
        if (historicalMissed(event.id(), target.id())) {
            return new AttendanceState(event.id(), event.title(), event.startAt(), "MISSED", false);
        }
        return new AttendanceState(event.id(), event.title(), event.startAt(), eligibleNow ? "NOT_OPEN" : "NOT_ELIGIBLE", false);
    }

    private boolean historicalMissed(long eventId, long memberId) {
        List<SessionRow> sessions = jdbc.query("SELECT sess.id,sess.expires_at,sess.closed_at,sess.qr_token_hash,sess.code_hash "
                + "FROM attendance_eligibility_snapshot snap "
                + "JOIN check_in_session sess ON sess.id = snap.check_in_session_id "
                + "WHERE sess.event_id = ? AND snap.member_id = ? ORDER BY sess.id DESC LIMIT 1",
                (rs, row) -> sessionRow(rs), eventId, memberId);
        if (sessions.isEmpty()) return false;
        SessionRow latest = sessions.getFirst();
        return latest.closedAt() != null || !clock.instant().isBefore(latest.expiresAt());
    }

    private String attendance(long eventId, long memberId) {
        List<String> rows = jdbc.query("SELECT status FROM attendance WHERE event_id = ? AND member_id = ?",
                (rs, row) -> rs.getString(1), eventId, memberId);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private EventRow lockEvent(long eventId) { return eventRow(eventId, true); }
    private EventRow findEvent(long eventId) { return eventRow(eventId, false); }
    private EventRow eventRow(long eventId, boolean lock) {
        List<EventRow> rows = jdbc.query("SELECT id,title,ob_eligible,start_at FROM event WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
                (rs, row) -> new EventRow(rs.getLong(1), rs.getString(2), rs.getBoolean(3), eventTime(rs)), eventId);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "행사를 찾을 수 없습니다.");
        return rows.getFirst();
    }

    private MemberRow lockMember(long id) { return readMember(id, true); }
    private MemberRow memberRow(long id) { return readMember(id, false); }
    private MemberRow readMember(long id, boolean lock) {
        List<MemberRow> rows = jdbc.query("SELECT id,name,status,member_type FROM member WHERE id = ?"
                + (lock ? " FOR UPDATE" : ""), (rs, row) -> new MemberRow(rs.getLong(1), rs.getString(2),
                rs.getString(3), rs.getString(4)), id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "단원을 찾을 수 없습니다.");
        return rows.getFirst();
    }

    private List<SessionRow> activeSession(long eventId) {
        return jdbc.query("SELECT id,expires_at,closed_at,qr_token_hash,code_hash FROM check_in_session "
                + "WHERE event_id = ? AND closed_at IS NULL ORDER BY id DESC LIMIT 1",
                (rs, row) -> sessionRow(rs), eventId);
    }

    private SessionRow currentSession(long eventId, long id) {
        List<SessionRow> rows = jdbc.query("SELECT id,expires_at,closed_at,qr_token_hash,code_hash FROM check_in_session "
                + "WHERE event_id = ? AND id = ?", (rs, row) -> sessionRow(rs), eventId, id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "출석 창을 찾을 수 없습니다.");
        return rows.getFirst();
    }

    private static SessionRow sessionRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp closed = rs.getTimestamp(3);
        return new SessionRow(rs.getLong(1), rs.getTimestamp(2).toInstant(),
                closed == null ? null : closed.toInstant(), rs.getString(4), rs.getString(5));
    }
    private static boolean eligible(EventRow event, MemberRow member) {
        return "APPROVED".equals(member.status()) && ("ACTIVE".equals(member.type())
                || event.obEligible() && "OB".equals(member.type()));
    }
    private String newQrToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private String newCode() {
        StringBuilder value = new StringBuilder(8);
        for (int i = 0; i < 8; i++) value.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        return value.toString();
    }
    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }
    private static boolean constantTimeEquals(String first, String second) {
        return MessageDigest.isEqual(HexFormat.of().parseHex(first), HexFormat.of().parseHex(second));
    }
    private static Timestamp time(Instant instant) { return Timestamp.from(instant); }
    private static Instant eventTime(java.sql.ResultSet rs) throws java.sql.SQLException {
        return rs.getObject("start_at", LocalDateTime.class).toInstant(ZoneOffset.UTC);
    }
    private static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "NOT_ELIGIBLE", "이 행사의 출석 대상이 아닙니다.");
    }
    private record EventRow(long id, String title, boolean obEligible, Instant startAt) {}
    private record MemberRow(long id, String name, String status, String type) {}
    private record SessionRow(long id, Instant expiresAt, Instant closedAt, String qrHash, String codeHash) {}
    public record IssuedSession(Long sessionId, Instant expiresAt, String qrUrl, String code) {}
    public record SessionStatus(Long sessionId, Instant expiresAt, boolean open) {}
    public record AttendanceState(Long eventId, String eventTitle, Instant startAt, String status, boolean checkInOpen) {}
    public record AdminAttendance(Long memberId, String name, String part, Integer cohort, String status) {}
}
