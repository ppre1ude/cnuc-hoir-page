package kr.ac.jnu.choir.event;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.HashSet;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {
    private final EventRepository events;
    private final Clock clock;

    public EventService(EventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Event> list(Instant from, Instant to) {
        validInterval(from, to);
        return events.findOverlapping(from, to);
    }

    @Transactional(readOnly = true)
    public Event get(long id) {
        return events.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "EVENT_NOT_FOUND", "행사를 찾을 수 없습니다."));
    }

    @Transactional
    public Event create(String title, String description, Instant startAt, Instant endAt,
            boolean obEligible, boolean publicVisible) {
        validInterval(startAt, endAt);
        return events.save(new Event(title, description, startAt, endAt, obEligible, publicVisible, clock));
    }

    @Transactional
    public List<Event> createBatch(List<EventController.EventInput> input) {
        if (input == null || input.isEmpty() || input.size() > 31) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EVENT_BATCH", "한 번에 1~31개 일정을 등록할 수 있습니다.");
        }
        var starts = new HashSet<Instant>();
        for (var item : input) {
            validInterval(item.startAt(), item.endAt());
            if (!starts.add(item.startAt())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_EVENT_TIME", "선택한 시작 시각이 중복됩니다.");
            }
        }
        return events.saveAll(input.stream().map(item -> new Event(item.title(), item.description(),
                item.startAt(), item.endAt(), item.obEligible(), item.publicVisible(), clock)).toList());
    }

    @Transactional
    public Event update(long id, String title, String description, Instant startAt, Instant endAt,
            boolean obEligible, boolean publicVisible) {
        validInterval(startAt, endAt);
        Event event = get(id);
        event.update(title, description, startAt, endAt, obEligible, publicVisible, clock);
        return event;
    }

    private void validInterval(Instant from, Instant to) {
        if (from == null || to == null || !from.isBefore(to)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_EVENT_TIME", "행사 시작과 종료 시각을 확인해 주세요.");
        }
    }
}
