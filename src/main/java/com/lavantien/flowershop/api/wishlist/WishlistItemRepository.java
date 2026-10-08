package com.lavantien.flowershop.api.wishlist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {

	List<WishlistItem> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

	Optional<WishlistItem> findByUserIdAndProductId(Long userId, Long productId);
}
