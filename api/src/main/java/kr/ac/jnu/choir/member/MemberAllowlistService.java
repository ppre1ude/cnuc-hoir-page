package kr.ac.jnu.choir.member;

import java.time.Clock;
import java.sql.Timestamp;
import java.util.Locale;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberAllowlistService {
    private final MemberAllowlistRepository allowlist;
    private final MemberRepository members;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public MemberAllowlistService(MemberAllowlistRepository allowlist, MemberRepository members,
            JdbcTemplate jdbc, Clock clock) {
        this.allowlist = allowlist;
        this.members = members;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<MemberAllowlist> list(int page, int size) {
        return allowlist.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    @Transactional
    public MemberAllowlist add(long actorId, String email, MemberType type, String name) {
        Member actor = requireAdmin(actorId);
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        if (allowlist.findByEmailIgnoreCase(normalized).isPresent()) throw duplicate();
        String displayName = name == null || name.isBlank() ? null : name.strip();
        MemberAllowlist entry;
        try {
            entry = allowlist.saveAndFlush(new MemberAllowlist(normalized, type, displayName, actor, clock.instant()));
        } catch (DataIntegrityViolationException exception) {
            throw duplicate();
        }
        audit(actorId, normalized, "ADD", type);
        return entry;
    }

    @Transactional
    public void remove(long actorId, long entryId) {
        requireAdmin(actorId);
        MemberAllowlist entry = allowlist.findByIdForUpdate(entryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ALLOWLIST_NOT_FOUND", "명단 항목을 찾을 수 없습니다."));
        audit(actorId, entry.getEmail(), "REMOVE", entry.getMemberType());
        allowlist.delete(entry);
    }

    private Member requireAdmin(long id) {
        Member actor = members.findByIdForUpdate(id)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "운영진만 이용할 수 있습니다."));
        if (!actor.isAdmin() || actor.getStatus() != AccountStatus.APPROVED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "운영진만 이용할 수 있습니다.");
        }
        return actor;
    }

    private void audit(long actorId, String email, String action, MemberType type) {
        jdbc.update("INSERT INTO member_allowlist_log (actor_member_id, email, action, member_type, acted_at) VALUES (?, ?, ?, ?, ?)",
                actorId, email, action, type.name(), Timestamp.from(clock.instant()));
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "ALLOWLIST_DUPLICATE", "이미 명단에 등록된 이메일입니다.");
    }
}
