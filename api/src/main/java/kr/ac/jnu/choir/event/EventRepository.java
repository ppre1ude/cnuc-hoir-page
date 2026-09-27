package kr.ac.jnu.choir.event;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRepository extends JpaRepository<Event, Long> {
    @Query("select e from Event e where e.startAt < :to and e.endAt > :from order by e.startAt asc, e.id asc")
    List<Event> findOverlapping(@Param("from") Instant from, @Param("to") Instant to);
}
