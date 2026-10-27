package kr.ac.jnu.choir.auth;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import kr.ac.jnu.choir.member.MemberRole;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Part;
import kr.ac.jnu.choir.member.Role;

// 설계 문서의 권한 표를 그대로 옮긴 계산기입니다. 겸임이면 직책 권한의 합입니다.
public final class Permissions {
    private static final Set<Permission> STAFF = EnumSet.of(Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES,
            Permission.VIEW_MEMBERS);
    private static final Set<Permission> VICE_PRESIDENT = EnumSet.of(Permission.APPROVE_APPLICATIONS,
            Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_PART_REHEARSALS, Permission.MANAGE_PART_ATTENDANCE);
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
            // 총무는 단장단이라 파트연습 응답 집계와 출석 관리를 함께 봅니다. 파트연습을 열지는 않습니다.
            if (role == Role.TREASURER) result.add(Permission.MANAGE_PART_ATTENDANCE);
        }
        return result;
    }

    // 수석 직책에 붙은 파트입니다. 수석은 이 파트의 파트연습만 열고 집계·출석을 봅니다. 활동 단원이 아니면 비어 있습니다.
    public static Set<Part> leadParts(MemberType memberType, Collection<MemberRole> roles) {
        Set<Part> result = EnumSet.noneOf(Part.class);
        if (memberType != MemberType.ACTIVE) return result;
        for (MemberRole role : roles) {
            if (role.getRole() == Role.SECTION_LEAD && role.getPart() != null) result.add(role.getPart());
        }
        return result;
    }
}
