package com.lavantien.flowershop.api.branch;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StockLevelRepository extends JpaRepository<StockLevel, Long> {
	Optional<StockLevel> findByBranchIdAndProductId(Long branchId, Long productId);

	List<StockLevel> findByBranchId(Long branchId);

	boolean existsByBranchId(Long branchId);

	// Sole stock source: the product view sums every branch row and treats
	// no rows as zero, never as unknown.
	@Query("select coalesce(sum(s.quantity), 0) from StockLevel s where s.productId = :productId")
	long sumQuantityByProductId(Long productId);
}
