package kr.ac.jnu.choir.event;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.HashSet;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Part;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {
    private static final DateTimeFormatter SEOUL_TIME = DateTimeFormatter.ofPattern("yyyy년 M월 d일 HH:mm")
            .withZone(ZoneId.of("Asia/Seoul"));
    private final EventRepository events;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public EventService(EventRepository events, JdbcTemplate jdbc, Clock clock) {
        this.events = events;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Event> list(Instant from, Instant to) {
        validInterval(from, to);
        return events.findOverlapping(from, to);
    }

    @Transactional(readOnly = true)
    public Event get(long id) {
        return events.findById(id).orElseThrow(EventService::notFound);
    }

    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND", "행사를 찾을 수 없습니다.");
    }

    @Transactional
    public Event create(String title, String description, Instant startAt, Instant endAt, EventKind kind, Part part,
            boolean obEligible, boolean publicVisible) {
        validInterval(startAt, endAt);
        validKind(kind, part);
        return events.save(new Event(title, description, startAt, endAt, kind, part, obEligible, publicVisible, clock));
    }

    @Transactional
    public List<Event> createBatch(List<EventController.EventInput> input) {
        if (input == null || input.isEmpty() || input.size() > 31) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EVENT_BATCH", "한 번에 1~31개 일정을 등록할 수 있습니다.");
        }
        // 파트연습처럼 제목이 다른 일정은 같은 시각에 열릴 수 있어, 같은 제목과 같은 시작 시각만 중복으로 봅니다.
        // ponytail: 동시에 들어온 두 일괄 등록은 둘 다 통과할 수 있음, 막아야 하면 (title, start_at) 고유 제약을 추가
        var requested = new HashSet<String>();
        for (var item : input) {
            validInterval(item.startAt(), item.endAt());
            validKind(item.kind(), item.part());
            if (!requested.add(duplicateKey(item.title(), item.startAt()))) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_EVENT_TIME", "같은 제목의 일정이 같은 시작 시각에 두 번 들어 있습니다.");
            }
        }
        Instant from = input.stream().map(EventController.EventInput::startAt).min(Comparator.naturalOrder()).orElseThrow();
        Instant to = input.stream().map(EventController.EventInput::endAt).max(Comparator.naturalOrder()).orElseThrow();
        events.findOverlapping(from, to).stream()
                // 취소된 일정은 같은 제목과 시각으로 다시 등록할 수 있습니다.
                .filter(saved -> !saved.isCancelled() && requested.contains(duplicateKey(saved.getTitle(), saved.getStartAt())))
                .map(Event::getStartAt).findFirst()
                .ifPresent(clash -> {
                    throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EVENT_TIME", SEOUL_TIME.format(clash)
                            + "에 시작하는 같은 제목의 일정이 이미 있습니다. 그 날짜를 빼고 다시 등록해 주세요.");
                });
        return events.saveAll(input.stream().map(item -> new Event(item.title(), item.description(),
                item.startAt(), item.endAt(), item.kind(), item.part(), item.obEligible(), item.publicVisible(), clock)).toList());
    }

    private static String duplicateKey(String title, Instant startAt) {
        return title.strip() + "\n" + startAt;
    }

    @Transactional
    public Event update(long id, String title, String description, Instant startAt, Instant endAt, EventKind kind,
            Part part, boolean obEligible, boolean publicVisible) {
        validInterval(startAt, endAt);
        validKind(kind, part);
        Event event = get(id);
        event.update(title, description, startAt, endAt, kind, part, obEligible, publicVisible, clock);
        return event;
    }

    // 먼저 flush해 일정 행을 잠근 뒤 창을 닫습니다. 같은 일정을 잠그고 출석 창을 여는 요청이 닫기를 빠져나가지 못합니다.
    @Transactional
    public Event cancel(long id) {
        Event event = get(id);
        event.cancel(clock);
        events.flush();
        jdbc.update("UPDATE check_in_session SET closed_at = ? WHERE event_id = ? AND closed_at IS NULL",
                Timestamp.from(clock.instant()), id);
        return event;
    }

    // 닫힌 출석 창은 저절로 다시 열지 않습니다. 필요하면 운영진이 다시 엽니다.
    @Transactional
    public Event restore(long id) {
        Event event = get(id);
        event.restore(clock);
        return event;
    }

    // 응답, 출석 창, 출석, 정정 기록의 외래 키에 cascade가 없어, 기록이 하나라도 있으면 DB가 삭제를 거부합니다.
    @Transactional
    public void delete(long id) {
        Event event = get(id);
        if (!event.isCancelled()) {
            throw new ApiException(HttpStatus.CONFLICT, "EVENT_NOT_CANCELLED", "취소한 일정만 삭제할 수 있습니다.");
        }
        try {
            events.delete(event);
            events.flush();
        } catch (DataIntegrityViolationException hasRecords) {
            throw new ApiException(HttpStatus.CONFLICT, "EVENT_HAS_RECORDS",
                    "참석 응답이나 출석 기록이 있어 삭제할 수 없습니다. 취소 상태로 그대로 두면 기록이 보존됩니다.");
        }
    }

    // 파트연습은 파트가 하나 있어야 하고, 전체연습과 행사에는 파트가 없어야 합니다. DB 제약과 같은 규칙입니다.
    private void validKind(EventKind kind, Part part) {
        if (kind == null || (kind == EventKind.PART_REHEARSAL) != (part != null)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EVENT_PART",
                    "파트연습은 파트를 하나 골라야 하고, 전체연습과 행사에는 파트를 고르지 않습니다.");
        }
    }

    private void validInterval(Instant from, Instant to) {
        if (from == null || to == null || !from.isBefore(to)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EVENT_TIME", "행사 시작과 종료 시각을 확인해 주세요.");
        }
    }
}
