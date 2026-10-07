package com.lavantien.flowershop.api.order;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {
	Page<Order> findByUserId(Long userId, Pageable pageable);

	// The report window: from inclusive, to exclusive on whole UTC days.
	List<Order> findByPlacedAtGreaterThanEqualAndPlacedAtLessThan(Instant from, Instant to);

	// Mutating paths read the order under SELECT ... FOR UPDATE, always after
	// the payment row lock, so confirm, cancel, and admin transitions
	// serialize per order.
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select o from Order o where o.id = :id")
	Optional<Order> lockById(Long id);
}
