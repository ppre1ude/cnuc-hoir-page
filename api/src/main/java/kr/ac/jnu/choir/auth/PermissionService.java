package kr.ac.jnu.choir.auth;

import java.util.List;
import java.util.Set;
import kr.ac.jnu.choir.common.ApiException;
import kr.ac.jnu.choir.member.AccountStatus;
import kr.ac.jnu.choir.member.Member;
import kr.ac.jnu.choir.member.MemberRepository;
import kr.ac.jnu.choir.member.MemberRole;
import kr.ac.jnu.choir.member.MemberRoleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PermissionService {
    private final MemberRoleRepository roles;
    private final MemberRepository members;

    public PermissionService(MemberRoleRepository roles, MemberRepository members) {
        this.roles = roles;
        this.members = members;
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

    // 서비스 안에서 잠금 조회로 다시 확인할 때 씁니다.
    @Transactional
    public Member require(long memberId, Permission permission) {
        Member actor = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다."));
        if (!of(actor).contains(permission)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_REQUIRED", "이 기능을 쓸 권한이 없습니다.");
        }
        return actor;
    }
}
