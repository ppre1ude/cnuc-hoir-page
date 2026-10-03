package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import java.util.List;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Role;
import org.junit.jupiter.api.Test;

class PermissionsTest {
    @Test void siteAdminHasEveryPermission() {
        assertThat(Permissions.of(true, MemberType.ACTIVE, List.of())).isEqualTo(EnumSet.allOf(Permission.class));
    }

    @Test void ordinaryActiveMemberOnlyViewsMinutes() {
        assertThat(Permissions.of(false, MemberType.ACTIVE, List.of())).containsExactly(Permission.VIEW_MINUTES);
    }

    @Test void obAndUnknownTypeHaveNothing() {
        assertThat(Permissions.of(false, MemberType.OB, List.of())).isEmpty();
        assertThat(Permissions.of(false, null, List.of())).isEmpty();
    }

    @Test void presidentManagesRolesButNotSiteAdmins() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.PRESIDENT));
        assertThat(permissions).contains(Permission.MANAGE_ROLES, Permission.REVOKE_ACCESS, Permission.MANAGE_ALLOWLIST,
                Permission.APPROVE_APPLICATIONS, Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_PART_REHEARSALS,
                Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES, Permission.VIEW_MEMBERS, Permission.VIEW_MINUTES);
        assertThat(permissions).doesNotContain(Permission.MANAGE_SITE_ADMINS, Permission.DELETE_MINUTES);
    }

    @Test void vicePresidentApprovesAndRunsRehearsalsButCannotAssignRoles() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.VICE_PRESIDENT));
        assertThat(permissions).contains(Permission.APPROVE_APPLICATIONS, Permission.MANAGE_FULL_REHEARSALS,
                Permission.MANAGE_PART_REHEARSALS, Permission.MANAGE_EVENTS);
        assertThat(permissions).doesNotContain(Permission.MANAGE_ROLES, Permission.REVOKE_ACCESS, Permission.MANAGE_ALLOWLIST);
    }

    @Test void staffRolesShareTheSameSet() {
        var expected = EnumSet.of(Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES, Permission.VIEW_MEMBERS, Permission.VIEW_MINUTES);
        for (Role role : List.of(Role.TREASURER, Role.DEPARTMENT_HEAD, Role.DEPARTMENT_MEMBER, Role.SECTION_LEAD)) {
            assertThat(Permissions.of(false, MemberType.ACTIVE, List.of(role))).as(role.name()).isEqualTo(expected);
        }
    }

    @Test void combinedRolesAreUnioned() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.VICE_PRESIDENT, Role.SECTION_LEAD));
        assertThat(permissions).contains(Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_EVENTS);
    }
}
