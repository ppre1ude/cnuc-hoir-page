package kr.ac.jnu.choir.notice;

import java.time.Clock;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoticeService {
    private final NoticeRepository notices;
    private final NoticePollService polls;
    private final Clock clock;

    public NoticeService(NoticeRepository notices, NoticePollService polls, Clock clock) {
        this.notices = notices;
        this.polls = polls;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<Notice> list(int page, int size, boolean admin) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "조회 조건을 확인해 주세요.");
        }
        var order = Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.desc("id"));
        return admin ? notices.findAll(PageRequest.of(page, size, order))
                : notices.findByPublishedTrue(PageRequest.of(page, size, order));
    }

    @Transactional(readOnly = true)
    public Notice get(long id, boolean admin) {
        Notice notice = notices.findById(id).orElseThrow(this::missing);
        if (!admin && !notice.isPublished()) throw missing();
        return notice;
    }

    @Transactional
    public Notice create(String title, String body, boolean published, Member author) {
        return create(title, body, published, author, null);
    }

    @Transactional
    public Notice create(String title, String body, boolean published, Member author,
            NoticePollService.PollInput poll) {
        Notice notice = notices.saveAndFlush(new Notice(title, body, published, author, clock));
        if (poll != null) polls.create(notice.getId(), poll);
        return notice;
    }

    @Transactional
    public Notice update(long id, String title, String body, boolean published) {
        return update(id, title, body, published, null);
    }

    @Transactional
    public Notice update(long id, String title, String body, boolean published,
            NoticePollService.PollInput poll) {
        Notice notice = notices.findById(id).orElseThrow(this::missing);
        notice.update(title, body, published, clock);
        if (poll != null) polls.create(id, poll);
        return notice;
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "공지를 찾을 수 없습니다.");
    }
}
