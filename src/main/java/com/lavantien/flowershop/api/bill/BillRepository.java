package com.lavantien.flowershop.api.bill;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BillRepository extends JpaRepository<Bill, Long> {
	List<Bill> findByUserId(Long userId);

	// Stands in for the order reference until the order entity lands and
	// swaps the check; the HAS_ORDERS contract stays identical.
	boolean existsByUserId(Long userId);
}
