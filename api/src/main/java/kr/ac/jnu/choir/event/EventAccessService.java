package kr.ac.jnu.choir.event;

import kr.ac.jnu.choir.auth.PermissionService;
import kr.ac.jnu.choir.auth.Permissions;
import kr.ac.jnu.choir.member.Member;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 요청마다 단원의 직책을 읽어 일정 권한을 만듭니다. 직책을 바꾸면 다음 요청부터 바로 반영됩니다.
@Service
public class EventAccessService {
    private final PermissionService permissions;

    public EventAccessService(PermissionService permissions) {
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public EventAccess of(Member member) {
        return new EventAccess(member.isAdmin(), member.getMemberType(), member.getPart(), permissions.of(member),
                Permissions.leadParts(member.getMemberType(), permissions.rolesOf(member)));
    }
}
