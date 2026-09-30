package kr.ac.jnu.choir.member;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.Locale;
import kr.ac.jnu.choir.common.AdminActionLog;
import kr.ac.jnu.choir.common.AdminActionLogRepository;
import kr.ac.jnu.choir.common.ApiException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperatorPreapprovalService {
    private final OperatorPreapprovalRepository preapprovals;
    private final MemberRepository members;
    private final AdminActionLogRepository actionLogs;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public OperatorPreapprovalService(OperatorPreapprovalRepository preapprovals, MemberRepository members,
            AdminActionLogRepository actionLogs, JdbcTemplate jdbc, Clock clock) {
        this.preapprovals = preapprovals;
        this.members = members;
        this.actionLogs = actionLogs;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<OperatorPreapproval> list(int page, int size) {
        return preapprovals.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    @Transactional
    public OperatorPreapproval add(long actorId, String email, MemberType type) {
        Member actor = requireAdmin(actorId);
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        lockEmail(normalized);
        if (preapprovals.findByEmailIgnoreCase(normalized).isPresent()) throw duplicate();
        members.findByEmailIgnoreCase(normalized).ifPresent(existing -> {
            if (existing.isAdmin() || existing.getGoogleSubject() == null
                    || (existing.getStatus() != AccountStatus.APPROVED
                    && existing.getStatus() != AccountStatus.APPROVAL_PENDING)) {
                throw new ApiException(HttpStatus.CONFLICT, "OPERATOR_PREAPPROVAL_UNAVAILABLE",
                        "이 계정은 사전 등록할 수 없습니다. 계정 상태를 확인해 주세요.");
            }
        });
        OperatorPreapproval entry;
        try {
            entry = preapprovals.saveAndFlush(new OperatorPreapproval(normalized, type, actor, clock.instant()));
        } catch (DataIntegrityViolationException exception) {
            throw duplicate();
        }
        audit(actorId, normalized, "ADD", type);
        return entry;
    }

    @Transactional
    public void remove(long actorId, long entryId) {
        requireAdmin(actorId);
        OperatorPreapproval candidate = preapprovals.findById(entryId)
                .orElseThrow(OperatorPreapprovalService::notFound);
        lockEmail(candidate.getEmail());
        OperatorPreapproval entry = preapprovals.findByIdForUpdate(entryId)
                .orElseThrow(OperatorPreapprovalService::notFound);
        audit(actorId, entry.getEmail(), "REMOVE", entry.getMemberType());
        preapprovals.delete(entry);
        preapprovals.flush();
    }

    @Transactional
    public boolean grantIfListed(Member member) {
        if (member.getGoogleSubject() == null || member.isAdmin()
                || (member.getStatus() != AccountStatus.APPROVAL_PENDING
                && member.getStatus() != AccountStatus.APPROVED)) return false;
        lockEmail(member.getEmail());
        OperatorPreapproval entry = preapprovals.findByEmailIgnoreCase(member.getEmail()).orElse(null);
        if (entry == null) return false;
        AccountStatus before = member.getStatus();
        member.approveAsAdmin(entry.getMemberType(), clock);
        actionLogs.save(new AdminActionLog(entry.getCreatedBy(), member, "OPERATOR_PREAPPROVAL", before,
                member.getStatus(), "사전 등록된 운영진의 구글 계정 확인", clock.instant()));
        return true;
    }

    private Member requireAdmin(long id) {
        Member actor = members.findByIdForUpdate(id)
                .orElseThrow(OperatorPreapprovalService::adminRequired);
        if (!actor.isAdmin() || actor.getStatus() != AccountStatus.APPROVED) throw adminRequired();
        return actor;
    }

    private void lockEmail(String email) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> { }, email);
    }

    private void audit(long actorId, String email, String action, MemberType type) {
        jdbc.update("""
                INSERT INTO operator_preapproval_log (actor_member_id, email, action, member_type, acted_at)
                VALUES (?, ?, ?, ?, ?)
                """, actorId, email, action, type.name(), Timestamp.from(clock.instant()));
    }

    private static ApiException adminRequired() {
        return new ApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "운영진만 이용할 수 있습니다.");
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "OPERATOR_PREAPPROVAL_DUPLICATE",
                "이미 운영진 사전 등록에 포함된 이메일입니다.");
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "OPERATOR_PREAPPROVAL_NOT_FOUND",
                "운영진 사전 등록 항목을 찾을 수 없습니다.");
    }
}
