package kr.ac.jnu.choir.member;

import java.time.Clock;
import java.sql.Timestamp;
import java.util.Locale;
import kr.ac.jnu.choir.auth.Permission;
import kr.ac.jnu.choir.auth.PermissionService;
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
    private final PermissionService permissions;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public MemberAllowlistService(MemberAllowlistRepository allowlist, PermissionService permissions,
            JdbcTemplate jdbc, Clock clock) {
        this.allowlist = allowlist;
        this.permissions = permissions;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<MemberAllowlist> list(int page, int size) {
        return allowlist.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    @Transactional
    public MemberAllowlist add(long actorId, String email, MemberType type, String name) {
        Member actor = permissions.require(actorId, Permission.MANAGE_ALLOWLIST);
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
        permissions.require(actorId, Permission.MANAGE_ALLOWLIST);
        MemberAllowlist entry = allowlist.findByIdForUpdate(entryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ALLOWLIST_NOT_FOUND", "명단 항목을 찾을 수 없습니다."));
        audit(actorId, entry.getEmail(), "REMOVE", entry.getMemberType());
        allowlist.delete(entry);
    }

    private void audit(long actorId, String email, String action, MemberType type) {
        jdbc.update("INSERT INTO member_allowlist_log (actor_member_id, email, action, member_type, acted_at) VALUES (?, ?, ?, ?, ?)",
                actorId, email, action, type.name(), Timestamp.from(clock.instant()));
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "ALLOWLIST_DUPLICATE", "이미 명단에 등록된 이메일입니다.");
    }
}
