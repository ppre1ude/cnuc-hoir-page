package kr.ac.jnu.choir.auth;

import java.util.List;
import java.util.Set;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRole;
import kr.ac.jnu.choir.member.MemberRoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PermissionService {
    private final MemberRoleRepository roles;

    public PermissionService(MemberRoleRepository roles) {
        this.roles = roles;
    }

    @Transactional(readOnly = true)
    public List<MemberRole> rolesOf(Member member) {
        return roles.findByMemberIdOrderByAssignedAtAsc(member.getId());
    }

    // 요청마다 DB에서 직책을 읽으므로 직책을 바꾼 뒤 다시 로그인할 필요가 없습니다.
    @Transactional(readOnly = true)
    public Set<Permission> of(Member member) {
        if (member.getStatus() != AccountStatus.APPROVED) return Set.of();
        return Permissions.of(member.isAdmin(), member.getMemberType(),
                rolesOf(member).stream().map(MemberRole::getRole).toList());
    }
}
