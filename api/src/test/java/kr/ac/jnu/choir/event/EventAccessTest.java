package kr.ac.jnu.choir.event;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import kr.ac.jnu.choir.auth.Permissions;
import kr.ac.jnu.choir.member.MemberRole;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Part;
import kr.ac.jnu.choir.member.Role;
import org.junit.jupiter.api.Test;

class EventAccessTest {
    private static MemberRole role(Role role, Part part) {
        return new MemberRole(null, role, null, null, part, null, Instant.EPOCH);
    }

    private static EventAccess access(boolean siteAdmin, MemberType type, Part part, MemberRole... roles) {
        List<MemberRole> list = List.of(roles);
        return new EventAccess(siteAdmin, type, part,
                Permissions.of(siteAdmin, type, list.stream().map(MemberRole::getRole).toList()),
                Permissions.leadParts(type, list));
    }

    private static Event event(EventKind kind, Part part) {
        return new Event("일정", "", Instant.parse("2026-10-27T10:30:00Z"), Instant.parse("2026-10-27T12:30:00Z"),
                kind, part, false, false, Clock.systemUTC());
    }

    static final EventAccess ADMIN = access(true, MemberType.ACTIVE, null);
    static final EventAccess PRESIDENT = access(false, MemberType.ACTIVE, Part.ALTO, role(Role.PRESIDENT, null));
    static final EventAccess VICE = access(false, MemberType.ACTIVE, Part.SOPRANO, role(Role.VICE_PRESIDENT, null));
    static final EventAccess TREASURER = access(false, MemberType.ACTIVE, Part.BASS, role(Role.TREASURER, null));
    static final EventAccess HEAD = access(false, MemberType.ACTIVE, Part.ALTO, role(Role.DEPARTMENT_HEAD, null));
    static final EventAccess TENOR_LEAD = access(false, MemberType.ACTIVE, Part.TENOR, role(Role.SECTION_LEAD, Part.TENOR));
    static final EventAccess SOPRANO_LEAD = access(false, MemberType.ACTIVE, Part.SOPRANO, role(Role.SECTION_LEAD, Part.SOPRANO));
    static final EventAccess VICE_AND_TENOR_LEAD = access(false, MemberType.ACTIVE, Part.TENOR,
            role(Role.VICE_PRESIDENT, null), role(Role.SECTION_LEAD, Part.TENOR));
    static final EventAccess TENOR = access(false, MemberType.ACTIVE, Part.TENOR);
    static final EventAccess SOPRANO = access(false, MemberType.ACTIVE, Part.SOPRANO);
    static final EventAccess NO_PART = access(false, MemberType.ACTIVE, null);
    static final EventAccess TENOR_OB = access(false, MemberType.OB, Part.TENOR);
    // OB가 된 뒤 남은 수석 직책은 권한이 되지 않습니다.
    static final EventAccess OB_WITH_OLD_LEAD = access(false, MemberType.OB, Part.TENOR, role(Role.SECTION_LEAD, Part.TENOR));

    private static void expect(Map<String, EventAccess> people, java.util.function.Predicate<EventAccess> check,
            List<String> allowed) {
        people.forEach((name, person) -> assertThat(check.test(person)).as(name).isEqualTo(allowed.contains(name)));
    }

    static final Map<String, EventAccess> EVERYONE = Map.ofEntries(Map.entry("사이트 관리자", ADMIN),
            Map.entry("단장", PRESIDENT), Map.entry("부단장", VICE), Map.entry("총무", TREASURER), Map.entry("부장", HEAD),
            Map.entry("테너수석", TENOR_LEAD), Map.entry("소프라노수석", SOPRANO_LEAD),
            Map.entry("부단장 겸 테너수석", VICE_AND_TENOR_LEAD), Map.entry("테너 단원", TENOR),
            Map.entry("소프라노 단원", SOPRANO), Map.entry("파트 미지정 단원", NO_PART), Map.entry("테너 OB", TENOR_OB),
            Map.entry("수석이었던 OB", OB_WITH_OLD_LEAD));

    @Test void fullRehearsalsAreManagedByPresidentAndVicePresident() {
        expect(EVERYONE, person -> person.canManage(EventKind.FULL_REHEARSAL, null),
                List.of("사이트 관리자", "단장", "부단장", "부단장 겸 테너수석"));
    }

    @Test void partRehearsalsAreManagedByPresidentVicePresidentAndThatPartsLead() {
        expect(EVERYONE, person -> person.canManage(EventKind.PART_REHEARSAL, Part.TENOR),
                List.of("사이트 관리자", "단장", "부단장", "테너수석", "부단장 겸 테너수석"));
        expect(EVERYONE, person -> person.canManage(EventKind.PART_REHEARSAL, Part.SOPRANO),
                List.of("사이트 관리자", "단장", "부단장", "소프라노수석", "부단장 겸 테너수석"));
    }

    @Test void eventsAreManagedByEveryOperator() {
        expect(EVERYONE, person -> person.canManage(EventKind.EVENT, null),
                List.of("사이트 관리자", "단장", "부단장", "총무", "부장", "테너수석", "소프라노수석", "부단장 겸 테너수석"));
    }

    @Test void partRehearsalRosterIsForPresidentsTreasurerAndThatPartsLead() {
        expect(EVERYONE, person -> person.canManageRoster(event(EventKind.PART_REHEARSAL, Part.TENOR)),
                List.of("사이트 관리자", "단장", "부단장", "총무", "테너수석", "부단장 겸 테너수석"));
        expect(EVERYONE, person -> person.canManageRoster(event(EventKind.FULL_REHEARSAL, null)),
                List.of("사이트 관리자", "단장", "부단장", "총무", "부장", "테너수석", "소프라노수석", "부단장 겸 테너수석"));
    }

    @Test void partRehearsalIsSeenByThatPartAndOperatorsOnly() {
        expect(EVERYONE, person -> person.canSee(event(EventKind.PART_REHEARSAL, Part.TENOR)),
                List.of("사이트 관리자", "단장", "부단장", "총무", "부장", "테너수석", "소프라노수석", "부단장 겸 테너수석",
                        "테너 단원", "테너 OB", "수석이었던 OB"));
        expect(EVERYONE, person -> person.canSee(event(EventKind.EVENT, null)), List.copyOf(EVERYONE.keySet()));
    }

    @Test void onlyThatPartsMembersAreTargets() {
        assertThat(EventAccess.target(MemberType.ACTIVE, Part.TENOR, EventKind.PART_REHEARSAL, Part.TENOR, false)).isTrue();
        assertThat(EventAccess.target(MemberType.ACTIVE, Part.SOPRANO, EventKind.PART_REHEARSAL, Part.TENOR, false)).isFalse();
        assertThat(EventAccess.target(MemberType.ACTIVE, null, EventKind.PART_REHEARSAL, Part.TENOR, false)).isFalse();
        assertThat(EventAccess.target(MemberType.OB, Part.TENOR, EventKind.PART_REHEARSAL, Part.TENOR, true)).isTrue();
        assertThat(EventAccess.target(MemberType.OB, Part.TENOR, EventKind.PART_REHEARSAL, Part.TENOR, false)).isFalse();
        assertThat(EventAccess.target(MemberType.ACTIVE, null, EventKind.FULL_REHEARSAL, null, false)).isTrue();
        assertThat(EventAccess.target(MemberType.OB, Part.TENOR, EventKind.EVENT, null, false)).isFalse();
        assertThat(EventAccess.target(MemberType.OB, Part.TENOR, EventKind.EVENT, null, true)).isTrue();
        assertThat(EventAccess.target(null, Part.TENOR, EventKind.EVENT, null, true)).isFalse();
    }
}
