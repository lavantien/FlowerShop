package com.lavantien.flowershop.api.wishlist;

import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.error.NotFoundException;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.product.ProductView;
import com.lavantien.flowershop.api.security.Auth;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {
	private final WishlistItemRepository wishlistItemRepository;
	private final ProductRepository productRepository;
	private final StockLevelRepository stockLevelRepository;

	public WishlistController(WishlistItemRepository wishlistItemRepository, ProductRepository productRepository,
		StockLevelRepository stockLevelRepository) {
		this.wishlistItemRepository = wishlistItemRepository;
		this.productRepository = productRepository;
		this.stockLevelRepository = stockLevelRepository;
	}

	@GetMapping("/me")
	public List<WishlistEntry> myWishlist(HttpServletRequest request) {
		return wishlistItemRepository.findByUserIdOrderByCreatedAtDescIdDesc(Auth.userId(request)).stream()
			.map(item -> productRepository.findById(item.getProductId())
				.map(product -> new WishlistEntry(view(product), item.getCreatedAt()))
				.orElse(null))
			.filter(Objects::nonNull)
			.toList();
	}

	@PostMapping("/me/{productId}")
	public ToggleOutcome toggle(@PathVariable Long productId, HttpServletRequest request) {
		Long userId = Auth.userId(request);
		productRepository.findById(productId)
			.orElseThrow(() -> new NotFoundException("no product with id " + productId));
		return wishlistItemRepository.findByUserIdAndProductId(userId, productId)
			.map(item -> {
				wishlistItemRepository.delete(item);
				return new ToggleOutcome(false);
			})
			.orElseGet(() -> {
				try {
					wishlistItemRepository.save(new WishlistItem(userId, productId));
				} catch (DataIntegrityViolationException raced) {
				}
				return new ToggleOutcome(true);
			});
	}

	public record WishlistEntry(ProductView product, Instant createdAt) {}

	public record ToggleOutcome(boolean added) {}

	private ProductView view(Product product) {
		return ProductView.of(product, stockLevelRepository.sumQuantityByProductId(product.getId()));
	}
}
