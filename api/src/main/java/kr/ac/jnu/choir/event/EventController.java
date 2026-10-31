package kr.ac.jnu.choir.event;

import kr.ac.jnu.choir.auth.Permission;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotEmpty;
import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.auth.SessionMemberService;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Part;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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
    private final EventRsvpService rsvps;
    private final EventAccessService accesses;

    public EventController(SessionMemberService sessions, EventService events, EventRsvpService rsvps,
            EventAccessService accesses) {
        this.sessions = sessions;
        this.events = events;
        this.rsvps = rsvps;
        this.accesses = accesses;
    }

    @GetMapping("/events")
    public List<EventItem> list(HttpServletRequest request, @RequestParam Instant from, @RequestParam Instant to) {
        Member member = sessions.requireApproved(request);
        boolean ob = member.getMemberType() == MemberType.OB;
        EventAccess access = accesses.of(member);
        return events.list(from, to).stream().filter(event -> !ob || event.isObEligible())
                .filter(access::canSee).map(this::item).toList();
    }

    @GetMapping("/events/{id}")
    public EventItem get(HttpServletRequest request, @PathVariable long id) {
        Member member = sessions.requireApproved(request);
        Event event = events.get(id);
        // 다른 파트 단원에게는 그 파트연습이 있다는 것도 알리지 않습니다.
        if (!accesses.of(member).canSee(event)) throw EventService.notFound();
        return item(event);
    }

    // 운영진이 아니면 일정을 읽기 전에 거부합니다. 운영진은 종류·파트별 권한을 다시 확인합니다.
    @PostMapping("/admin/events")
    public ResponseEntity<EventItem> create(HttpServletRequest request, @Valid @RequestBody EventInput body) {
        EventAccess access = accesses.of(sessions.require(request, Permission.MANAGE_EVENTS));
        requireManage(access.canManage(body.kind(), body.part()));
        return ResponseEntity.status(HttpStatus.CREATED).body(item(events.create(body.title(), body.description(),
                body.startAt(), body.endAt(), body.kind(), body.part(), body.obEligible(), body.publicVisible())));
    }

    // 한 항목이라도 권한이 없으면 아무것도 저장하지 않습니다.
    @PostMapping("/admin/events/batch")
    public ResponseEntity<List<EventItem>> createBatch(HttpServletRequest request, @Valid @RequestBody EventBatchInput body) {
        EventAccess access = accesses.of(sessions.require(request, Permission.MANAGE_EVENTS));
        requireManage(body.events().stream().allMatch(item -> access.canManage(item.kind(), item.part())));
        return ResponseEntity.status(HttpStatus.CREATED).body(events.createBatch(body.events()).stream().map(this::item).toList());
    }

    @GetMapping("/events/rsvps/me")
    public List<EventRsvpService.MyRsvp> myRsvps(HttpServletRequest request, @RequestParam Instant from,
            @RequestParam Instant to) {
        return rsvps.mine(sessions.requireApproved(request), from, to);
    }

    @GetMapping("/events/{id}/rsvp")
    public EventRsvpService.MyRsvp myRsvp(HttpServletRequest request, @PathVariable long id) {
        return rsvps.mine(sessions.requireApproved(request), id);
    }

    @PutMapping("/events/{id}/rsvp")
    public EventRsvpService.MyRsvp respond(HttpServletRequest request, @PathVariable long id,
            @Valid @RequestBody RsvpInput body) {
        return rsvps.respond(sessions.requireApproved(request), id, body.choice());
    }

    @GetMapping("/admin/events/{id}/rsvps")
    public EventRsvpService.AdminRsvps adminRsvps(HttpServletRequest request, @PathVariable long id) {
        EventAccess access = accesses.of(sessions.require(request, Permission.MANAGE_EVENTS));
        requireManage(access.canManageRoster(events.get(id)));
        return rsvps.adminView(id);
    }

    // 바꾸기 전과 바꾼 뒤의 종류·파트 모두에 권한이 있어야 합니다. 수석이 자기 파트연습을 다른 종류나 파트로 옮기지 못합니다.
    @PutMapping("/admin/events/{id}")
    public EventItem update(HttpServletRequest request, @PathVariable long id, @Valid @RequestBody EventInput body) {
        EventAccess access = accesses.of(sessions.require(request, Permission.MANAGE_EVENTS));
        requireManage(access.canManage(events.get(id)) && access.canManage(body.kind(), body.part()));
        return item(events.update(id, body.title(), body.description(), body.startAt(), body.endAt(),
                body.kind(), body.part(), body.obEligible(), body.publicVisible()));
    }

    // 취소, 되돌리기, 삭제의 권한은 수정과 같습니다.
    @PostMapping("/admin/events/{id}/cancel")
    public EventItem cancel(HttpServletRequest request, @PathVariable long id) {
        requireManageEvent(request, id);
        return item(events.cancel(id));
    }

    @PostMapping("/admin/events/{id}/restore")
    public EventItem restore(HttpServletRequest request, @PathVariable long id) {
        requireManageEvent(request, id);
        return item(events.restore(id));
    }

    @DeleteMapping("/admin/events/{id}")
    public ResponseEntity<Void> delete(HttpServletRequest request, @PathVariable long id) {
        requireManageEvent(request, id);
        events.delete(id);
        return ResponseEntity.noContent().build();
    }

    private void requireManageEvent(HttpServletRequest request, long id) {
        EventAccess access = accesses.of(sessions.require(request, Permission.MANAGE_EVENTS));
        requireManage(access.canManage(events.get(id)));
    }

    private static void requireManage(boolean allowed) {
        if (!allowed) throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다.");
    }

    private EventItem item(Event event) {
        return new EventItem(event.getId(), event.getTitle(), event.getDescription(), event.getStartAt(),
                event.getEndAt(), event.getKind(), event.getPart(), event.isObEligible(), event.isPublicVisible(),
                event.getCreatedAt(), event.getUpdatedAt(), event.getCancelledAt());
    }

    public record EventInput(@NotBlank @Size(max = 200) String title,
            @NotNull @Size(max = 10000) String description, @NotNull Instant startAt, @NotNull Instant endAt,
            @NotNull EventKind kind, Part part, @NotNull Boolean obEligible, @NotNull Boolean publicVisible) {}
    public record EventBatchInput(@NotEmpty @Size(max = 31) List<@NotNull @Valid EventInput> events) {}
    public record RsvpInput(@NotNull EventRsvpService.Choice choice) {}
    public record EventItem(Long id, String title, String description, Instant startAt, Instant endAt,
            EventKind kind, Part part, boolean obEligible, boolean publicVisible, Instant createdAt, Instant updatedAt,
            Instant cancelledAt) {}
}
