package com.lavantien.flowershop.api.branch;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StockLevelRepository extends JpaRepository<StockLevel, Long> {
	Optional<StockLevel> findByBranchIdAndProductId(Long branchId, Long productId);

	List<StockLevel> findByBranchId(Long branchId);

	boolean existsByBranchId(Long branchId);

	@Query("select coalesce(sum(s.quantity), 0) from StockLevel s where s.productId = :productId")
	long sumQuantityByProductId(Long productId);

	@Modifying
	@Query("update StockLevel s set s.quantity = s.quantity - :n where s.id = :id and s.quantity >= :n")
	int decrementIfAvailable(Long id, int n);

	@Modifying
	@Query("update StockLevel s set s.quantity = s.quantity + :n where s.id = :id")
	int increment(Long id, int n);
}
