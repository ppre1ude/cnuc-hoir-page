package kr.ac.jnu.choir.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import kr.ac.jnu.choir.member.MemberRole;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Part;
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

    @Test void obHoldingLeadershipRoleStillHasNothing() {
        assertThat(Permissions.of(false, MemberType.OB, List.of(Role.PRESIDENT))).isEmpty();
    }

    @Test void presidentManagesRolesButNotSiteAdmins() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.PRESIDENT));
        assertThat(permissions).isEqualTo(EnumSet.complementOf(EnumSet.of(Permission.MANAGE_SITE_ADMINS, Permission.DELETE_MINUTES)));
    }

    @Test void vicePresidentApprovesAndRunsRehearsalsButCannotAssignRoles() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.VICE_PRESIDENT));
        assertThat(permissions).isEqualTo(EnumSet.of(Permission.APPROVE_APPLICATIONS, Permission.MANAGE_FULL_REHEARSALS,
                Permission.MANAGE_PART_REHEARSALS, Permission.MANAGE_PART_ATTENDANCE, Permission.MANAGE_EVENTS,
                Permission.WRITE_MINUTES, Permission.VIEW_MEMBERS, Permission.VIEW_MINUTES));
    }

    @Test void staffRolesShareTheSameSet() {
        var expected = EnumSet.of(Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES, Permission.VIEW_MEMBERS, Permission.VIEW_MINUTES);
        for (Role role : List.of(Role.DEPARTMENT_HEAD, Role.DEPARTMENT_MEMBER, Role.SECTION_LEAD)) {
            assertThat(Permissions.of(false, MemberType.ACTIVE, List.of(role))).as(role.name()).isEqualTo(expected);
        }
    }

    @Test void treasurerAlsoManagesPartAttendanceButNotPartRehearsals() {
        assertThat(Permissions.of(false, MemberType.ACTIVE, List.of(Role.TREASURER))).isEqualTo(EnumSet.of(
                Permission.MANAGE_PART_ATTENDANCE, Permission.MANAGE_EVENTS, Permission.WRITE_MINUTES,
                Permission.VIEW_MEMBERS, Permission.VIEW_MINUTES));
    }

    @Test void leadPartsComeFromSectionLeadRolesOfActiveMembersOnly() {
        var roles = List.of(new MemberRole(null, Role.SECTION_LEAD, null, null, Part.TENOR, null, Instant.EPOCH),
                new MemberRole(null, Role.SECTION_LEAD, null, null, Part.BASS, null, Instant.EPOCH),
                new MemberRole(null, Role.VICE_PRESIDENT, null, null, null, null, Instant.EPOCH));
        assertThat(Permissions.leadParts(MemberType.ACTIVE, roles)).containsExactlyInAnyOrder(Part.TENOR, Part.BASS);
        assertThat(Permissions.leadParts(MemberType.OB, roles)).isEmpty();
        assertThat(Permissions.leadParts(MemberType.ACTIVE, List.of())).isEmpty();
    }

    @Test void combinedRolesAreUnioned() {
        var permissions = Permissions.of(false, MemberType.ACTIVE, List.of(Role.VICE_PRESIDENT, Role.SECTION_LEAD));
        assertThat(permissions).contains(Permission.MANAGE_FULL_REHEARSALS, Permission.MANAGE_EVENTS);
    }
}
