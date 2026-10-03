package kr.ac.jnu.choir.auth;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Role;

// 설계 문서의 권한 표를 그대로 옮긴 계산기입니다. 겸임이면 직책 권한의 합입니다.
public final class Permissions {
    private static final Set<Permission> STAFF = EnumSet.of(Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES,
            Permission.VIEW_MEMBERS);
    private static final Set<Permission> VICE_PRESIDENT = EnumSet.of(Permission.APPROVE_APPLICATIONS,
            Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_PART_REHEARSALS);
    private static final Set<Permission> PRESIDENT = EnumSet.of(Permission.MANAGE_ROLES, Permission.REVOKE_ACCESS,
            Permission.MANAGE_ALLOWLIST);

    private Permissions() {
    }

    public static Set<Permission> of(boolean siteAdmin, MemberType memberType, Collection<Role> roles) {
        if (siteAdmin) return EnumSet.allOf(Permission.class);
        Set<Permission> result = EnumSet.noneOf(Permission.class);
        if (memberType != MemberType.ACTIVE) return result;
        result.add(Permission.VIEW_MINUTES);
        for (Role role : roles) {
            result.addAll(STAFF);
            if (role == Role.PRESIDENT || role == Role.VICE_PRESIDENT) result.addAll(VICE_PRESIDENT);
            if (role == Role.PRESIDENT) result.addAll(PRESIDENT);
        }
        return result;
    }
}
