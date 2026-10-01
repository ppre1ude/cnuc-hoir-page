package kr.ac.jnu.choir.notice;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoticePollService {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate namedJdbc;
    private final Clock clock;

    public NoticePollService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.namedJdbc = new NamedParameterJdbcTemplate(jdbc);
        this.clock = clock;
    }

    public record PollInput(String question, String firstOption, String secondOption, Instant closesAt) {}
    public record PollView(String question, String firstOption, String secondOption, Instant closesAt,
            boolean closed, long firstCount, long secondCount, Integer myChoice) {}
    public record PollSummary(String firstOption, String secondOption, Instant closesAt,
            boolean closed, Integer myChoice) {}
    public record Respondent(Long memberId, String name, String email, int choice, Instant updatedAt) {}
    public record AdminPollView(PollView poll, List<Respondent> respondents) {}

    @Transactional
    public void create(long noticeId, PollInput input) {
        String question = input.question().strip();
        String first = input.firstOption().strip();
        String second = input.secondOption().strip();
        if (question.isEmpty() || first.isEmpty() || second.isEmpty() || first.equals(second)
                || question.length() > 200 || first.length() > 80 || second.length() > 80
                || !input.closesAt().isAfter(clock.instant())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_POLL", "투표 질문, 선택지와 마감 시각을 확인해 주세요.");
        }
        if (!jdbc.queryForList("SELECT id FROM notice_poll WHERE notice_id = ?", Long.class, noticeId).isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "POLL_EXISTS", "이 공지에는 이미 투표가 있습니다.");
        }
        try {
            jdbc.update("INSERT INTO notice_poll (notice_id, question, first_option, second_option, closes_at, created_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?)", noticeId, question, first, second,
                    dbTime(input.closesAt()), dbTime(clock.instant()));
        } catch (DuplicateKeyException caught) {
            throw new ApiException(HttpStatus.CONFLICT, "POLL_EXISTS", "이 공지에는 이미 투표가 있습니다.");
        }
    }

    @Transactional(readOnly = true)
    public PollView memberView(long noticeId, long memberId) {
        PollRow poll = find(noticeId, false);
        if (!poll.published()) throw missing();
        return view(poll, memberId);
    }

    @Transactional(readOnly = true)
    public Map<Long, PollSummary> memberSummaries(List<Long> noticeIds, long memberId) {
        if (noticeIds.isEmpty()) return Map.of();
        Instant now = clock.instant();
        // 현재 페이지의 투표와 본인 선택만 한 번에 조회한다.
        return namedJdbc.query("SELECT p.notice_id, p.first_option, p.second_option, p.closes_at, v.choice "
                + "FROM notice_poll p JOIN notice n ON n.id = p.notice_id "
                + "LEFT JOIN notice_poll_vote v ON v.poll_id = p.id AND v.member_id = :memberId "
                + "WHERE n.published = true AND p.notice_id IN (:noticeIds)",
                Map.of("noticeIds", noticeIds, "memberId", memberId),
                (rs, row) -> {
                    Instant closesAt = rs.getObject("closes_at", LocalDateTime.class).toInstant(ZoneOffset.UTC);
                    return Map.entry(rs.getLong("notice_id"), new PollSummary(rs.getString("first_option"),
                            rs.getString("second_option"), closesAt, !now.isBefore(closesAt),
                            rs.getObject("choice", Integer.class)));
                }).stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    @Transactional
    public PollView vote(long noticeId, long memberId, int choice) {
        if (choice != 1 && choice != 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CHOICE", "투표 선택지를 확인해 주세요.");
        }
        PollRow poll = find(noticeId, true);
        if (!poll.published()) throw missing();
        Instant now = clock.instant();
        if (!now.isBefore(poll.closesAt())) {
            throw new ApiException(HttpStatus.CONFLICT, "POLL_CLOSED", "투표가 마감되었습니다.");
        }
        List<Integer> existing = jdbc.queryForList(
                "SELECT choice FROM notice_poll_vote WHERE poll_id = ? AND member_id = ?", Integer.class,
                poll.id(), memberId);
        if (existing.isEmpty()) {
            jdbc.update("INSERT INTO notice_poll_vote (poll_id, member_id, choice, created_at, updated_at) "
                    + "VALUES (?, ?, ?, ?, ?)", poll.id(), memberId, choice, dbTime(now), dbTime(now));
        } else if (existing.getFirst() != choice) {
            jdbc.update("UPDATE notice_poll_vote SET choice = ?, updated_at = ? WHERE poll_id = ? AND member_id = ?",
                    choice, dbTime(now), poll.id(), memberId);
        }
        return view(poll, memberId);
    }

    @Transactional(readOnly = true)
    public AdminPollView adminView(long noticeId) {
        PollRow poll = find(noticeId, false);
        List<Respondent> respondents = jdbc.query("SELECT v.member_id, m.name, m.email, v.choice, v.updated_at "
                + "FROM notice_poll_vote v JOIN member m ON m.id = v.member_id WHERE v.poll_id = ? "
                + "ORDER BY v.updated_at DESC, v.member_id",
                (rs, row) -> new Respondent(rs.getLong("member_id"), rs.getString("name"),
                        rs.getString("email"), rs.getInt("choice"),
                        rs.getObject("updated_at", LocalDateTime.class).toInstant(ZoneOffset.UTC)),
                poll.id());
        return new AdminPollView(view(poll, null), respondents);
    }

    private PollView view(PollRow poll, Long memberId) {
        long[] counts = new long[2];
        jdbc.query("SELECT choice, COUNT(*) AS total FROM notice_poll_vote WHERE poll_id = ? GROUP BY choice",
                rs -> { counts[rs.getInt("choice") - 1] = rs.getLong("total"); }, poll.id());
        Integer mine = memberId == null ? null : jdbc.queryForList(
                "SELECT choice FROM notice_poll_vote WHERE poll_id = ? AND member_id = ?", Integer.class,
                poll.id(), memberId).stream().findFirst().orElse(null);
        return new PollView(poll.question(), poll.firstOption(), poll.secondOption(), poll.closesAt(),
                !clock.instant().isBefore(poll.closesAt()), counts[0], counts[1], mine);
    }

    private PollRow find(long noticeId, boolean lock) {
        String sql = "SELECT p.id, p.question, p.first_option, p.second_option, p.closes_at, n.published "
                + "FROM notice_poll p JOIN notice n ON n.id = p.notice_id WHERE p.notice_id = ?"
                + (lock ? " FOR UPDATE" : "");
        return jdbc.query(sql, (rs, row) -> new PollRow(rs.getLong("id"), rs.getString("question"),
                rs.getString("first_option"), rs.getString("second_option"),
                rs.getObject("closes_at", LocalDateTime.class).toInstant(ZoneOffset.UTC),
                rs.getBoolean("published")), noticeId)
                .stream().findFirst().orElseThrow(this::missing);
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "POLL_NOT_FOUND", "투표를 찾을 수 없습니다.");
    }

    private LocalDateTime dbTime(Instant value) {
        return LocalDateTime.ofInstant(value, ZoneOffset.UTC);
    }

    private record PollRow(long id, String question, String firstOption, String secondOption,
            Instant closesAt, boolean published) {}
}
