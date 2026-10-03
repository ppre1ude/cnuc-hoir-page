package kr.ac.jnu.choir.member;

// 부원이 속한 계입니다. 기획계·홍보계는 기획·홍보부, 악보계·비품계는 관리부입니다.
public enum Unit {
    PLANNING(Department.PLANNING_PR), PR(Department.PLANNING_PR),
    SCORES(Department.MANAGEMENT), SUPPLIES(Department.MANAGEMENT);

    private final Department department;

    Unit(Department department) {
        this.department = department;
    }

    public Department department() {
        return department;
    }
}
