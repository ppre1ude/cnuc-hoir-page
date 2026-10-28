package kr.ac.jnu.choir.event;

import java.util.Set;
import kr.ac.jnu.choir.auth.Permission;
import kr.ac.jnu.choir.member.MemberType;
import kr.ac.jnu.choir.member.Part;

// 한 단원이 일정을 고치거나, 응답 집계·출석을 관리하거나, 일정을 볼 수 있는지 판단합니다.
// 설계 문서의 권한 표와 파트연습 규칙을 옮겼습니다. 승인된 단원에 대해서만 만듭니다.
public record EventAccess(boolean siteAdmin, MemberType memberType, Part part, Set<Permission> permissions,
        Set<Part> leadParts) {

    // 등록·수정입니다. 정기연습과 비정기연습은 단장·부단장, 파트연습은 단장·부단장과 그 파트 수석, 행사는 운영진 전원입니다.
    public boolean canManage(EventKind kind, Part eventPart) {
        return switch (kind) {
            case REGULAR_REHEARSAL, EXTRA_REHEARSAL -> permissions.contains(Permission.MANAGE_FULL_REHEARSALS);
            case PART_REHEARSAL -> permissions.contains(Permission.MANAGE_PART_REHEARSALS) || leadParts.contains(eventPart);
            case EVENT -> permissions.contains(Permission.MANAGE_EVENTS);
        };
    }

    public boolean canManage(Event event) {
        return canManage(event.getKind(), event.getPart());
    }

    // 응답 집계와 출석 관리(출석 창, 출석 명단, 정정)입니다. 파트연습은 단장단과 그 파트 수석, 그 밖은 운영진 전원입니다.
    public boolean canManageRoster(Event event) {
        if (event.getKind() == EventKind.PART_REHEARSAL) {
            return permissions.contains(Permission.MANAGE_PART_ATTENDANCE) || leadParts.contains(event.getPart());
        }
        return permissions.contains(Permission.MANAGE_EVENTS);
    }

    // 파트연습은 그 파트 단원과 운영진(직책이 있는 활동 단원, 사이트 관리자)에게만 보입니다.
    // OB에게 OB 참여 대상 일정만 보이는 규칙은 목록에서 따로 적용합니다.
    public boolean canSee(Event event) {
        return event.getKind() != EventKind.PART_REHEARSAL || operator() || event.getPart() == part;
    }

    // 직책이 있는 활동 단원은 모두 행사 등록 권한을 가지므로 그것으로 운영진을 가립니다.
    private boolean operator() {
        return siteAdmin || permissions.contains(Permission.MANAGE_EVENTS);
    }

    // 참석 응답과 출석의 대상입니다. 활동 단원(OB 참여 대상이면 OB도)이고, 파트연습이면 그 파트 단원이어야 합니다.
    // 승인 여부는 부르는 쪽이 확인합니다.
    public static boolean target(MemberType memberType, Part memberPart, EventKind kind, Part eventPart,
            boolean obEligible) {
        boolean type = memberType == MemberType.ACTIVE || memberType == MemberType.OB && obEligible;
        return type && (kind != EventKind.PART_REHEARSAL || memberPart != null && memberPart == eventPart);
    }
}
