package kr.ac.jnu.choir.notice;

import kr.ac.jnu.choir.auth.Permission;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import kr.ac.jnu.choir.auth.SessionMemberService;
import org.springframework.data.domain.Page;
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
public class NoticeController {
    private final SessionMemberService sessions;
    private final NoticeService notices;
    private final NoticePollService polls;

    public NoticeController(SessionMemberService sessions, NoticeService notices, NoticePollService polls) {
        this.sessions = sessions;
        this.notices = notices;
        this.polls = polls;
    }

    @GetMapping("/notices")
    public NoticePage list(HttpServletRequest request, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var member = sessions.requireApproved(request);
        var result = notices.list(page, size, false);
        var summaries = polls.memberSummaries(result.getContent().stream().map(Notice::getId).toList(), member.getId());
        return new NoticePage(result.getContent().stream()
                .map(notice -> item(notice, summaries.get(notice.getId()))).toList(), page, size, result.getTotalElements());
    }

    @GetMapping("/notices/{id}")
    public NoticeItem get(HttpServletRequest request, @PathVariable long id) {
        sessions.requireApproved(request);
        return item(notices.get(id, false));
    }

    @GetMapping("/admin/notices")
    public NoticePage adminList(HttpServletRequest request, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        sessions.require(request, Permission.MANAGE_EVENTS);
        return page(notices.list(page, size, true), page, size);
    }

    @GetMapping("/admin/notices/{id}")
    public NoticeItem adminGet(HttpServletRequest request, @PathVariable long id) {
        sessions.require(request, Permission.MANAGE_EVENTS);
        return item(notices.get(id, true));
    }

    @PostMapping("/admin/notices")
    public ResponseEntity<NoticeItem> create(HttpServletRequest request, @Valid @RequestBody NoticeInput body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(item(notices.create(body.title(), body.body(),
                body.published(), sessions.require(request, Permission.MANAGE_EVENTS), poll(body.poll()))));
    }

    @PutMapping("/admin/notices/{id}")
    public NoticeItem update(HttpServletRequest request, @PathVariable long id, @Valid @RequestBody NoticeInput body) {
        sessions.require(request, Permission.MANAGE_EVENTS);
        return item(notices.update(id, body.title(), body.body(), body.published(), poll(body.poll())));
    }

    private NoticePage page(Page<Notice> result, int page, int size) {
        List<NoticeItem> items = result.getContent().stream().map(this::item).toList();
        return new NoticePage(items, page, size, result.getTotalElements());
    }

    private NoticeItem item(Notice notice) {
        return item(notice, null);
    }

    private NoticeItem item(Notice notice, NoticePollService.PollSummary summary) {
        return new NoticeItem(notice.getId(), notice.getTitle(), notice.getBody(), notice.getAuthor().getName(),
                notice.isPublished(), notice.getCreatedAt(), notice.getUpdatedAt(), notice.getPublishedAt(), summary);
    }

    private NoticePollService.PollInput poll(PollInput input) {
        return input == null ? null : new NoticePollService.PollInput(input.question(), input.firstOption(),
                input.secondOption(), input.closesAt());
    }

    public record NoticeInput(@NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 10000) String body, @NotNull Boolean published,
            @Valid PollInput poll) {}
    public record PollInput(@NotBlank @Size(max = 200) String question,
            @NotBlank @Size(max = 80) String firstOption,
            @NotBlank @Size(max = 80) String secondOption, @NotNull Instant closesAt) {}
    public record NoticeItem(Long id, String title, String body, String author, boolean published,
            Instant createdAt, Instant updatedAt, Instant publishedAt, NoticePollService.PollSummary poll) {}
    public record NoticePage(List<NoticeItem> items, int page, int size, long total) {}
}
