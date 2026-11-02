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
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.event.EventAccess;
import kr.ac.jnu.choir.event.EventKind;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Part;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CheckInService {
    // 출석 창은 행사 시작 30분 전부터 열 수 있고 끝나면 닫힙니다. 시작 15분 뒤부터 찍은 출석은 지각입니다. 규정이 바뀌면 여기만 고칩니다.
    static final Duration OPEN_BEFORE = Duration.ofMinutes(30);
    static final Duration LATE_AFTER = Duration.ofMinutes(15);
    // 출석 시각이 남는 상태. 정정으로 넣을 때도 정정 시각을 출석 시각으로 적습니다.
    private static final Set<String> PRESENT = Set.of("CHECKED_IN", "LATE");
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
        if (event.cancelled()) throw conflict("EVENT_CANCELLED", "취소된 일정이라 출석 창을 열 수 없습니다.");
        Instant now = clock.instant();
        if (now.isBefore(event.startAt().minus(OPEN_BEFORE))) {
            throw conflict("SESSION_NOT_YET", "출석 창은 연습 시작 30분 전부터 열 수 있습니다.");
        }
        if (!now.isBefore(event.endAt())) throw conflict("SESSION_CLOSED", "연습이 끝나 출석 창을 열 수 없습니다.");
        if (!activeSession(eventId).isEmpty()) throw conflict("SESSION_ALREADY_OPEN", "이미 열린 출석 창이 있습니다.");
        String qrToken = newQrToken();
        String code = newCode();
        // 만료 시각은 기록용입니다. 판정은 행사의 현재 end_at으로 하므로 행사 종료를 늦추면 창도 같이 늘어납니다.
        Instant expiresAt = event.endAt();
        Long id = jdbc.queryForObject("INSERT INTO check_in_session (event_id,opened_at,expires_at,qr_token_hash,code_hash,code) "
                + "VALUES (?,?,?,?,?,?) RETURNING id", Long.class,
                eventId, time(now), time(expiresAt), hash(qrToken), hash(code), code);
        List<Object> args = new ArrayList<>(List.of(id, time(now), event.obEligible()));
        jdbc.update("INSERT INTO attendance_eligibility_snapshot (check_in_session_id,member_id,snapshotted_at) "
                + "SELECT ?,m.id,? FROM member m WHERE m.status = 'APPROVED' "
                + "AND (m.member_type = 'ACTIVE' OR (? AND m.member_type = 'OB'))"
                + partCondition(event, "m.part", args), args.toArray());
        return new IssuedSession(id, expiresAt, "/events/" + eventId + "/check-in#token=" + qrToken, code);
    }

    @Transactional
    public IssuedSession rotate(long eventId, long sessionId) {
        EventRow event = lockEvent(eventId);
        SessionRow session = currentSession(eventId, sessionId);
        if (session.closedAt() != null || !withinWindow(event, clock.instant())) {
            throw conflict("SESSION_CLOSED", "출석 창이 닫혔거나 연습이 끝났습니다.");
        }
        String qrToken = newQrToken();
        String code = newCode();
        jdbc.update("UPDATE check_in_session SET qr_token_hash = ?, code_hash = ?, code = ? WHERE id = ?",
                hash(qrToken), hash(code), code, sessionId);
        return new IssuedSession(sessionId, event.endAt(), "/events/" + eventId + "/check-in#token=" + qrToken, code);
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
        if (event.cancelled()) throw conflict("EVENT_CANCELLED", "취소된 일정이라 출석할 수 없습니다.");
        Instant now = clock.instant();
        if (now.isBefore(event.startAt().minus(OPEN_BEFORE))) {
            throw conflict("CHECK_IN_NOT_YET", "출석은 연습 시작 30분 전부터 할 수 있습니다.");
        }
        List<SessionRow> active = activeSession(eventId);
        if (active.isEmpty() || !now.isBefore(event.endAt())) {
            throw conflict("SESSION_CLOSED", "출석 창이 닫혔거나 연습이 끝났습니다.");
        }
        SessionRow session = active.getFirst();
        // 배포 전에 연 창은 평문 코드가 없어(NULL) 어떤 숫자도 맞지 않고, QR 토큰만 통합니다.
        boolean valid = constantTimeEquals(session.qrHash(), hash(credential)) || credential.equals(session.code());
        if (!valid) throw conflict("INVALID_CREDENTIAL", "출석 코드가 유효하지 않습니다.");
        String status = now.isBefore(event.startAt().plus(LATE_AFTER)) ? "CHECKED_IN" : "LATE";
        try {
            jdbc.update("INSERT INTO attendance (event_id,member_id,status,checked_in_at) VALUES (?,?,?,?)",
                    eventId, member.getId(), status, time(now));
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
        // 시작 전이라도 출석 창을 연 행사는 넣습니다. 연습 10분 전에 출석해도 바로 목록에서 확인할 수 있어야 합니다.
        // 일정이 쌓일수록 느려지지 않게, 일정마다 따로 묻지 않고 한 쿼리로 받습니다.
        Instant now = clock.instant();
        return jdbc.query("SELECT e.id,e.title,e.ob_eligible,e.start_at,e.end_at,e.kind,e.part,e.cancelled_at,"
                + "a.status AS attendance_status,latest.event_id AS snapshot_event_id,latest.closed_at AS latest_closed_at,"
                + "active.id AS active_session_id "
                + "FROM event e "
                + "LEFT JOIN attendance a ON a.event_id = e.id AND a.member_id = ? "
                + "LEFT JOIN (SELECT DISTINCT ON (sess.event_id) sess.event_id,sess.closed_at "
                + "FROM attendance_eligibility_snapshot snap "
                + "JOIN check_in_session sess ON sess.id = snap.check_in_session_id "
                + "WHERE snap.member_id = ? ORDER BY sess.event_id,sess.id DESC) latest ON latest.event_id = e.id "
                + "LEFT JOIN check_in_session active ON active.event_id = e.id AND active.closed_at IS NULL "
                + "WHERE e.start_at <= ? OR EXISTS (SELECT 1 FROM check_in_session s WHERE s.event_id = e.id) "
                + "ORDER BY e.start_at DESC,e.id DESC",
                (rs, row) -> {
                    EventRow event = eventRow(rs);
                    boolean open = rs.getObject("active_session_id") != null && withinWindow(event, now);
                    boolean missed = rs.getObject("snapshot_event_id") != null
                            && lapsed(event, instant(rs.getTimestamp("latest_closed_at")));
                    return resolve(event, eligible(event, target), rs.getString("attendance_status"), open, missed);
                },
                member.getId(), member.getId(),
                // event 시각은 UTC 기준 TIMESTAMP라 JVM 시간대를 타는 Timestamp 대신 UTC LocalDateTime으로 비교합니다.
                LocalDateTime.ofInstant(now, ZoneOffset.UTC))
                .stream().filter(state -> !"NOT_ELIGIBLE".equals(state.status())).toList();
    }

    @Transactional(readOnly = true)
    public List<AdminAttendance> adminList(long eventId) {
        EventRow event = findEvent(eventId);
        boolean open = sessionOpen(event, activeSession(eventId), clock.instant());
        List<Object> args = new ArrayList<>(List.of(eventId, eventId, event.obEligible()));
        String eligibleNow = "(m.status = 'APPROVED' AND (m.member_type = 'ACTIVE' OR (? AND m.member_type = 'OB'))"
                + partCondition(event, "m.part", args) + ") ";
        // 정정할 때마다 다시 불리는 조회라, 단원마다 따로 묻지 않고 한 쿼리로 받습니다.
        return jdbc.query("SELECT m.id,m.name,m.status,m.member_type,m.part,m.cohort,"
                + "a.status,a.checked_in_at,a.corrected_at,latest.member_id,latest.closed_at "
                + "FROM member m "
                + "LEFT JOIN attendance a ON a.event_id = ? AND a.member_id = m.id "
                + "LEFT JOIN (SELECT DISTINCT ON (snap.member_id) snap.member_id,sess.closed_at "
                + "FROM attendance_eligibility_snapshot snap "
                + "JOIN check_in_session sess ON sess.id = snap.check_in_session_id "
                + "WHERE sess.event_id = ? ORDER BY snap.member_id,sess.id DESC) latest ON latest.member_id = m.id "
                + "WHERE " + eligibleNow
                + "OR a.member_id IS NOT NULL OR latest.member_id IS NOT NULL "
                + "ORDER BY m.name,m.id",
                (rs, row) -> {
                    MemberRow target = new MemberRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                            rs.getString(5));
                    boolean missed = rs.getObject(10) != null && lapsed(event, instant(rs.getTimestamp(11)));
                    String status = resolve(event, eligible(event, target), rs.getString(7), open, missed).status();
                    return new AdminAttendance(target.id(), target.name(), rs.getString(5),
                            rs.getObject(6, Integer.class), status,
                            instant(rs.getTimestamp(8)), instant(rs.getTimestamp(9)));
                }, args.toArray());
    }

    @Transactional(readOnly = true)
    public SessionStatus sessionStatus(long eventId) {
        EventRow event = findEvent(eventId);
        Instant opensAt = event.startAt().minus(OPEN_BEFORE);
        List<SessionRow> latest = latestSession(eventId);
        if (latest.isEmpty()) return new SessionStatus(null, event.endAt(), false, null, opensAt);
        SessionRow session = latest.getFirst();
        boolean open = session.closedAt() == null && withinWindow(event, clock.instant());
        return new SessionStatus(session.id(), event.endAt(), open, open ? session.code() : null, opensAt);
    }

    @Transactional
    public void correct(long eventId, long memberId, Member actor, String newStatus, String reason) {
        EventRow event = lockEvent(eventId);
        MemberRow target = lockMember(memberId);
        if (attendance(eventId, memberId) == null && !eligible(event, target)
                && !historicalMissed(event, memberId)) throw forbidden();
        AttendanceState previous = state(event, target);
        if (newStatus.equals(previous.status())) {
            throw conflict("ATTENDANCE_UNCHANGED", "출석 상태가 이미 같습니다.");
        }
        Instant now = clock.instant();
        if (attendance(eventId, memberId) == null) {
            jdbc.update("INSERT INTO attendance (event_id,member_id,status,checked_in_at,corrected_at) VALUES (?,?,?,?,?)",
                    eventId, memberId, newStatus, PRESENT.contains(newStatus) ? time(now) : null, time(now));
        } else {
            jdbc.update("UPDATE attendance SET status = ?, checked_in_at = ?, corrected_at = ? WHERE event_id = ? AND member_id = ?",
                    newStatus, PRESENT.contains(newStatus) ? time(now) : null, time(now), eventId, memberId);
        }
        jdbc.update("INSERT INTO admin_action_log (actor_member_id,target_member_id,action,previous_status,new_status,reason,acted_at,event_id) "
                + "VALUES (?,?,'ATTENDANCE_CORRECT',?,?,?,?,?)", actor.getId(), memberId, previous.status(),
                newStatus, reason.strip(), time(now), eventId);
    }

    private AttendanceState state(EventRow event, MemberRow target) {
        String stored = attendance(event.id(), target.id());
        if (stored != null || event.cancelled()) return resolve(event, false, stored, false, false);
        boolean eligibleNow = eligible(event, target);
        boolean open = sessionOpen(event, activeSession(event.id()), clock.instant());
        // 창이 열려 있고 대상이면 미출석 여부와 상관없으므로 조회를 아낍니다.
        return resolve(event, eligibleNow, null, open, !(open && eligibleNow) && historicalMissed(event, target.id()));
    }

    private static AttendanceState resolve(EventRow event, boolean eligibleNow, String stored, boolean open, boolean missed) {
        boolean checkInOpen = stored == null && !event.cancelled() && open && eligibleNow;
        String status;
        if (stored != null) status = stored;
        // 취소된 일정에 기록이 없으면 미출석이 아닙니다. 대상 아님으로 두어 내 출석 목록에서도 빠집니다.
        else if (event.cancelled()) status = "NOT_ELIGIBLE";
        else if (checkInOpen) status = "NOT_OPEN";
        else if (missed) status = "MISSED";
        else status = eligibleNow ? "NOT_OPEN" : "NOT_ELIGIBLE";
        return new AttendanceState(event.id(), event.title(), event.startAt(), status, checkInOpen);
    }

    /** 단원이 포함된 가장 최근 창이 닫혔거나 연습이 끝났는지 봅니다. */
    private boolean lapsed(EventRow event, Instant closedAt) {
        return closedAt != null || !clock.instant().isBefore(event.endAt());
    }

    private boolean historicalMissed(EventRow event, long memberId) {
        List<SessionRow> sessions = jdbc.query("SELECT sess.id,sess.expires_at,sess.closed_at,sess.qr_token_hash,sess.code "
                + "FROM attendance_eligibility_snapshot snap "
                + "JOIN check_in_session sess ON sess.id = snap.check_in_session_id "
                + "WHERE sess.event_id = ? AND snap.member_id = ? ORDER BY sess.id DESC LIMIT 1",
                (rs, row) -> sessionRow(rs), event.id(), memberId);
        if (sessions.isEmpty()) return false;
        return lapsed(event, sessions.getFirst().closedAt());
    }

    private static boolean withinWindow(EventRow event, Instant now) {
        return !now.isBefore(event.startAt().minus(OPEN_BEFORE)) && now.isBefore(event.endAt());
    }
    private static boolean sessionOpen(EventRow event, List<SessionRow> active, Instant now) {
        return !active.isEmpty() && withinWindow(event, now);
    }

    private String attendance(long eventId, long memberId) {
        AttendanceRow row = attendanceRow(eventId, memberId);
        return row == null ? null : row.status();
    }
    private AttendanceRow attendanceRow(long eventId, long memberId) {
        List<AttendanceRow> rows = jdbc.query("SELECT status,checked_in_at,corrected_at FROM attendance WHERE event_id = ? AND member_id = ?",
                (rs, row) -> new AttendanceRow(rs.getString(1), instant(rs.getTimestamp(2)), instant(rs.getTimestamp(3))), eventId, memberId);
        return rows.isEmpty() ? null : rows.getFirst();
    }
    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }

    private EventRow lockEvent(long eventId) { return eventRow(eventId, true); }
    private EventRow findEvent(long eventId) { return eventRow(eventId, false); }
    private EventRow eventRow(long eventId, boolean lock) {
        List<EventRow> rows = jdbc.query("SELECT id,title,ob_eligible,start_at,end_at,kind,part,cancelled_at FROM event WHERE id = ?"
                + (lock ? " FOR UPDATE" : ""), (rs, row) -> eventRow(rs), eventId);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "행사를 찾을 수 없습니다.");
        return rows.getFirst();
    }

    private MemberRow lockMember(long id) { return readMember(id, true); }
    private MemberRow memberRow(long id) { return readMember(id, false); }
    private MemberRow readMember(long id, boolean lock) {
        List<MemberRow> rows = jdbc.query("SELECT id,name,status,member_type,part FROM member WHERE id = ?"
                + (lock ? " FOR UPDATE" : ""), (rs, row) -> new MemberRow(rs.getLong(1), rs.getString(2),
                rs.getString(3), rs.getString(4), rs.getString(5)), id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "단원을 찾을 수 없습니다.");
        return rows.getFirst();
    }

    private List<SessionRow> activeSession(long eventId) {
        return jdbc.query("SELECT id,expires_at,closed_at,qr_token_hash,code FROM check_in_session "
                + "WHERE event_id = ? AND closed_at IS NULL ORDER BY id DESC LIMIT 1",
                (rs, row) -> sessionRow(rs), eventId);
    }

    private List<SessionRow> latestSession(long eventId) {
        return jdbc.query("SELECT id,expires_at,closed_at,qr_token_hash,code FROM check_in_session "
                + "WHERE event_id = ? ORDER BY id DESC LIMIT 1", (rs, row) -> sessionRow(rs), eventId);
    }

    private SessionRow currentSession(long eventId, long id) {
        List<SessionRow> rows = jdbc.query("SELECT id,expires_at,closed_at,qr_token_hash,code FROM check_in_session "
                + "WHERE event_id = ? AND id = ?", (rs, row) -> sessionRow(rs), eventId, id);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "출석 창을 찾을 수 없습니다.");
        return rows.getFirst();
    }

    private static SessionRow sessionRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp closed = rs.getTimestamp(3);
        return new SessionRow(rs.getLong(1), rs.getTimestamp(2).toInstant(),
                closed == null ? null : closed.toInstant(), rs.getString(4), rs.getString(5));
    }
    // 승인된 단원 중 일정의 참석 대상입니다. 파트연습이면 그 파트 단원만입니다.
    private static boolean eligible(EventRow event, MemberRow member) {
        return "APPROVED".equals(member.status()) && EventAccess.target(
                member.type() == null ? null : MemberType.valueOf(member.type()),
                member.part() == null ? null : Part.valueOf(member.part()),
                event.kind(), event.part(), event.obEligible());
    }

    // 파트연습이면 출석 대상 SQL에 그 파트 조건을 붙이고 인자를 더합니다. eligible과 같은 규칙입니다.
    private static String partCondition(EventRow event, String column, List<Object> args) {
        if (event.kind() != EventKind.PART_REHEARSAL) return "";
        args.add(event.part().name());
        return " AND " + column + " = ?";
    }
    private String newQrToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private String newCode() {
        // 소리 내어 불러 주기 쉬운 4자리 숫자. 앞자리 0도 그대로 둡니다. 시도 제한(계정당 1분 10회)이 찍어 맞추기를 막습니다.
        return String.format("%04d", random.nextInt(10000));
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
    private static Instant eventTime(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        return rs.getObject(column, LocalDateTime.class).toInstant(ZoneOffset.UTC);
    }
    private static EventRow eventRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        String part = rs.getString("part");
        return new EventRow(rs.getLong("id"), rs.getString("title"), rs.getBoolean("ob_eligible"), eventTime(rs, "start_at"),
                eventTime(rs, "end_at"), EventKind.valueOf(rs.getString("kind")), part == null ? null : Part.valueOf(part),
                rs.getObject("cancelled_at") != null);
    }
    private static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "NOT_ELIGIBLE", "이 행사의 출석 대상이 아닙니다.");
    }
    private record EventRow(long id, String title, boolean obEligible, Instant startAt, Instant endAt, EventKind kind,
            Part part, boolean cancelled) {}
    private record MemberRow(long id, String name, String status, String type, String part) {}
    private record SessionRow(long id, Instant expiresAt, Instant closedAt, String qrHash, String code) {}
    public record IssuedSession(Long sessionId, Instant expiresAt, String qrUrl, String code) {}
    // sessionId는 닫힌 창도 포함한 가장 최근 창, expiresAt은 행사 종료 시각, code는 열려 있을 때만, opensAt은 열 수 있는 시각입니다.
    public record SessionStatus(Long sessionId, Instant expiresAt, boolean open, String code, Instant opensAt) {}
    public record AttendanceState(Long eventId, String eventTitle, Instant startAt, String status, boolean checkInOpen) {}
    private record AttendanceRow(String status, Instant checkedInAt, Instant correctedAt) {}
    public record AdminAttendance(Long memberId, String name, String part, Integer cohort, String status,
            Instant checkedInAt, Instant correctedAt) {}
}
