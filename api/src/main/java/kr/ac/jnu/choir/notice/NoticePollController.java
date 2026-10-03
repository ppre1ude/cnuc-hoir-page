package kr.ac.jnu.choir.notice;

import kr.ac.jnu.choir.auth.Permission;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import kr.ac.jnu.choir.auth.SessionMemberService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class NoticePollController {
    private final SessionMemberService sessions;
    private final NoticePollService polls;

    public NoticePollController(SessionMemberService sessions, NoticePollService polls) {
        this.sessions = sessions;
        this.polls = polls;
    }

    @GetMapping("/notices/{id}/poll")
    public NoticePollService.PollView get(HttpServletRequest request, @PathVariable long id) {
        return polls.memberView(id, sessions.requireApproved(request).getId());
    }

    @PutMapping("/notices/{id}/poll/vote")
    public NoticePollService.PollView vote(HttpServletRequest request, @PathVariable long id,
            @Valid @RequestBody VoteInput body) {
        return polls.vote(id, sessions.requireApproved(request).getId(), body.choice());
    }

    @GetMapping("/admin/notices/{id}/poll")
    public NoticePollService.AdminPollView adminGet(HttpServletRequest request, @PathVariable long id) {
        sessions.require(request, Permission.MANAGE_EVENTS);
        return polls.adminView(id);
    }

    public record VoteInput(@NotNull Integer choice) {}
}
