package kr.ac.jnu.choir.event;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotEmpty;
import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.auth.SessionMemberService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class EventController {
    private final SessionMemberService sessions;
    private final EventService events;

    public EventController(SessionMemberService sessions, EventService events) {
        this.sessions = sessions;
        this.events = events;
    }

    @GetMapping("/events")
    public List<EventItem> list(HttpServletRequest request, @RequestParam Instant from, @RequestParam Instant to) {
        sessions.requireApproved(request);
        return events.list(from, to).stream().map(this::item).toList();
    }

    @GetMapping("/events/{id}")
    public EventItem get(HttpServletRequest request, @PathVariable long id) {
        sessions.requireApproved(request);
        return item(events.get(id));
    }

    @PostMapping("/admin/events")
    public ResponseEntity<EventItem> create(HttpServletRequest request, @Valid @RequestBody EventInput body) {
        sessions.requireAdmin(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(item(events.create(body.title(), body.description(),
                body.startAt(), body.endAt(), body.obEligible(), body.publicVisible())));
    }

    @PostMapping("/admin/events/batch")
    public ResponseEntity<List<EventItem>> createBatch(HttpServletRequest request, @Valid @RequestBody EventBatchInput body) {
        sessions.requireAdmin(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(events.createBatch(body.events()).stream().map(this::item).toList());
    }

    @PutMapping("/admin/events/{id}")
    public EventItem update(HttpServletRequest request, @PathVariable long id, @Valid @RequestBody EventInput body) {
        sessions.requireAdmin(request);
        return item(events.update(id, body.title(), body.description(), body.startAt(), body.endAt(),
                body.obEligible(), body.publicVisible()));
    }

    private EventItem item(Event event) {
        return new EventItem(event.getId(), event.getTitle(), event.getDescription(), event.getStartAt(),
                event.getEndAt(), event.isObEligible(), event.isPublicVisible(), event.getCreatedAt(), event.getUpdatedAt());
    }

    public record EventInput(@NotBlank @Size(max = 200) String title,
            @NotNull @Size(max = 10000) String description, @NotNull Instant startAt, @NotNull Instant endAt,
            @NotNull Boolean obEligible, @NotNull Boolean publicVisible) {}
    public record EventBatchInput(@NotEmpty @Size(max = 31) List<@NotNull @Valid EventInput> events) {}
    public record EventItem(Long id, String title, String description, Instant startAt, Instant endAt,
            boolean obEligible, boolean publicVisible, Instant createdAt, Instant updatedAt) {}
}
