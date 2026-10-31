package kr.ac.jnu.choir.event;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.Part;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventRsvpService {
    public enum Choice { ATTENDING, ABSENT }
    public record MyRsvp(long eventId, Choice choice) {}
    public record Respondent(long memberId, String name, String part, Integer cohort, Choice choice) {}
    public record AdminRsvps(long eventId, long attending, long absent, long unanswered,
            List<Respondent> members) {}

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public EventRsvpService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MyRsvp> mine(Member member, Instant from, Instant to) {
        validInterval(from, to);
        // 종류를 파트연습으로 바꾸기 전에 남은 다른 파트 단원의 응답은 내 응답에 보이지 않습니다.
        return jdbc.query("SELECT r.event_id, r.choice FROM event_rsvp r JOIN event e ON e.id = r.event_id "
                + "WHERE r.member_id = ? AND e.start_at < ? AND e.end_at > ? "
                + "AND (? = 'ACTIVE' OR e.ob_eligible = TRUE) "
                + "AND (e.kind <> 'PART_REHEARSAL' OR e.part = ?) ORDER BY e.start_at, e.id",
                (rs, row) -> new MyRsvp(rs.getLong("event_id"), Choice.valueOf(rs.getString("choice"))),
                member.getId(), dbTime(to), dbTime(from), member.getMemberType().name(),
                member.getPart() == null ? null : member.getPart().name());
    }

    @Transactional(readOnly = true)
    public MyRsvp mine(Member member, long eventId) {
        EventRow event = event(eventId, false);
        if (!event.targets(member)) return new MyRsvp(eventId, null);
        return jdbc.query("SELECT choice FROM event_rsvp WHERE event_id = ? AND member_id = ?",
                (rs, row) -> new MyRsvp(eventId, Choice.valueOf(rs.getString("choice"))),
                eventId, member.getId()).stream().findFirst().orElse(new MyRsvp(eventId, null));
    }

    @Transactional
    public MyRsvp respond(Member member, long eventId, Choice choice) {
        if (choice == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RSVP", "참석 또는 불참을 선택해 주세요.");
        }
        EventRow event = event(eventId, true);
        if (!event.targets(member)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EVENT_NOT_ELIGIBLE", "이 행사의 참여 대상이 아닙니다.");
        }
        if (event.cancelled()) {
            throw new ApiException(HttpStatus.CONFLICT, "EVENT_CANCELLED", "취소된 일정이라 참석 응답을 받지 않습니다.");
        }
        Instant now = clock.instant();
        if (!now.isBefore(event.startAt())) {
            throw new ApiException(HttpStatus.CONFLICT, "RSVP_CLOSED", "행사가 시작되어 참석 응답을 변경할 수 없습니다.");
        }
        jdbc.update("INSERT INTO event_rsvp (event_id, member_id, choice, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?) ON CONFLICT (event_id, member_id) DO UPDATE "
                + "SET choice = EXCLUDED.choice, updated_at = EXCLUDED.updated_at",
                eventId, member.getId(), choice.name(), dbTime(now), dbTime(now));
        return new MyRsvp(eventId, choice);
    }

    @Transactional(readOnly = true)
    public AdminRsvps adminView(long eventId) {
        EventRow event = event(eventId, false);
        // 파트연습이면 그 파트 단원만 응답 대상입니다. 미응답 수도 그 파트 기준입니다.
        boolean partRehearsal = event.kind() == EventKind.PART_REHEARSAL;
        List<Object> args = new ArrayList<>(List.of(eventId, event.obEligible()));
        if (partRehearsal) args.add(event.part().name());
        List<Respondent> respondents = jdbc.query("SELECT m.id, m.name, m.part, m.cohort, r.choice FROM member m "
                + "LEFT JOIN event_rsvp r ON r.member_id = m.id AND r.event_id = ? "
                + "WHERE m.status = 'APPROVED' AND (m.member_type = 'ACTIVE' "
                + "OR (? AND m.member_type = 'OB')) "
                + (partRehearsal ? "AND m.part = ? " : "")
                + "ORDER BY m.name, m.id",
                (rs, row) -> new Respondent(rs.getLong("id"), rs.getString("name"),
                        rs.getString("part"), rs.getObject("cohort", Integer.class),
                        rs.getString("choice") == null ? null : Choice.valueOf(rs.getString("choice"))),
                args.toArray());
        long attending = respondents.stream().filter(item -> item.choice() == Choice.ATTENDING).count();
        long absent = respondents.stream().filter(item -> item.choice() == Choice.ABSENT).count();
        return new AdminRsvps(eventId, attending, absent, respondents.size() - attending - absent, respondents);
    }

    private EventRow event(long eventId, boolean lock) {
        return jdbc.query("SELECT start_at, ob_eligible, kind, part, cancelled_at FROM event WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
                (rs, row) -> new EventRow(rs.getObject("start_at", LocalDateTime.class).toInstant(ZoneOffset.UTC),
                        rs.getBoolean("ob_eligible"), EventKind.valueOf(rs.getString("kind")),
                        rs.getString("part") == null ? null : Part.valueOf(rs.getString("part")),
                        rs.getObject("cancelled_at") != null),
                eventId).stream().findFirst().orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "행사를 찾을 수 없습니다."));
    }

    private void validInterval(Instant from, Instant to) {
        if (from == null || to == null || !from.isBefore(to)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EVENT_TIME", "조회 기간을 확인해 주세요.");
        }
    }

    private LocalDateTime dbTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private record EventRow(Instant startAt, boolean obEligible, EventKind kind, Part part, boolean cancelled) {
        boolean targets(Member member) {
            return EventAccess.target(member.getMemberType(), member.getPart(), kind, part, obEligible);
        }
    }
}
