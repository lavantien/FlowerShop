package com.lavantien.flowershop.api.wishlist;

import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.lavantien.flowershop.api.security.AuthTestSupport.persona;
import static com.lavantien.flowershop.api.security.AuthTestSupport.prime;
import static com.lavantien.flowershop.api.security.AuthTestSupport.tokenOf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WishlistControllerTest {
	private WishlistItemRepository wishlistItemRepository;
	private ProductRepository productRepository;
	private StockLevelRepository stockLevelRepository;
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		wishlistItemRepository = mock(WishlistItemRepository.class);
		productRepository = mock(ProductRepository.class);
		stockLevelRepository = mock(StockLevelRepository.class);
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		mockMvc = MockMvcBuilders.standaloneSetup(
				new WishlistController(wishlistItemRepository, productRepository, stockLevelRepository))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
	}

	private static Product product(long id, String name, long price) {
		Product product = new Product(name, "demo", "https://cdn.example/x.jpg", BigDecimal.valueOf(price),
			null, null, "IT-T", "IT-C");
		product.setId(id);
		return product;
	}

	private static WishlistItem row(long id, long userId, long productId, String createdAt) {
		WishlistItem item = new WishlistItem(userId, productId);
		item.setId(id);
		item.setCreatedAt(Instant.parse(createdAt));
		return item;
	}

	@Test
	void anonymousCannotListTheirWishlist() throws Exception {
		mockMvc.perform(get("/api/wishlist/me"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void memberListsTheirWishlistNewestFirst() throws Exception {
		when(wishlistItemRepository.findByUserIdOrderByCreatedAtDescIdDesc(4L)).thenReturn(List.of(
			row(11, 4, 2, "2026-10-06T09:00:00Z"),
			row(10, 4, 1, "2026-10-05T09:00:00Z")));
		when(productRepository.findById(1L)).thenReturn(Optional.of(product(1, "Red Rose", 100000)));
		when(productRepository.findById(2L)).thenReturn(Optional.of(product(2, "White Tulip", 50000)));
		when(stockLevelRepository.sumQuantityByProductId(1L)).thenReturn(25L);
		when(stockLevelRepository.sumQuantityByProductId(2L)).thenReturn(7L);

		mockMvc.perform(get("/api/wishlist/me").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$").isArray())
			.andExpect(jsonPath("$.length()").value(2))
			.andExpect(jsonPath("$[0].product.id").value(2))
			.andExpect(jsonPath("$[0].product.name").value("White Tulip"))
			.andExpect(jsonPath("$[0].product.price").value(50000))
			.andExpect(jsonPath("$[0].product.stock").value(7))
			.andExpect(jsonPath("$[0].createdAt").value("2026-10-06T09:00:00Z"))
			.andExpect(jsonPath("$[1].product.id").value(1))
			.andExpect(jsonPath("$[1].product.stock").value(25))
			.andExpect(jsonPath("$[1].createdAt").value("2026-10-05T09:00:00Z"));
	}

	@Test
	void listingSkipsRowsWhoseProductIsGone() throws Exception {
		when(wishlistItemRepository.findByUserIdOrderByCreatedAtDescIdDesc(4L)).thenReturn(List.of(
			row(11, 4, 2, "2026-10-06T09:00:00Z"),
			row(10, 4, 99, "2026-10-05T09:00:00Z")));
		when(productRepository.findById(2L)).thenReturn(Optional.of(product(2, "White Tulip", 50000)));
		when(stockLevelRepository.sumQuantityByProductId(2L)).thenReturn(7L);

		mockMvc.perform(get("/api/wishlist/me").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(1))
			.andExpect(jsonPath("$[0].product.id").value(2));
	}

	@Test
	void toggleAddsARowForAnUnknownProduct() throws Exception {
		when(productRepository.findById(1L)).thenReturn(Optional.of(product(1, "Red Rose", 100000)));
		when(wishlistItemRepository.findByUserIdAndProductId(4L, 1L)).thenReturn(Optional.empty());
		when(wishlistItemRepository.save(any(WishlistItem.class)))
			.thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/wishlist/me/1").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.added").value(true));

		ArgumentCaptor<WishlistItem> saved = ArgumentCaptor.forClass(WishlistItem.class);
		verify(wishlistItemRepository).save(saved.capture());
		assertEquals(4L, saved.getValue().getUserId());
		assertEquals(1L, saved.getValue().getProductId());
		assertNotNull(saved.getValue().getCreatedAt(), "the row must stamp its creation instant");
		assertTrue(saved.getValue().toString().contains("productId=1"), "toString must render the row");
	}

	@Test
	void toggleRemovesAnExistingRow() throws Exception {
		when(productRepository.findById(1L)).thenReturn(Optional.of(product(1, "Red Rose", 100000)));
		WishlistItem existing = row(10, 4, 1, "2026-10-05T09:00:00Z");
		when(wishlistItemRepository.findByUserIdAndProductId(4L, 1L)).thenReturn(Optional.of(existing));

		mockMvc.perform(post("/api/wishlist/me/1").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.added").value(false));

		verify(wishlistItemRepository).delete(existing);
		verify(wishlistItemRepository, never()).save(any(WishlistItem.class));
	}

	@Test
	void toggleAnswers404ForAnUnknownProduct() throws Exception {
		when(productRepository.findById(77L)).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/wishlist/me/77").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));

		verify(wishlistItemRepository, never()).delete(any(WishlistItem.class));
	}

	@Test
	void anonymousCannotToggle() throws Exception {
		mockMvc.perform(post("/api/wishlist/me/1"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void adminAlsoHoldsAWishlist() throws Exception {
		when(productRepository.findById(1L)).thenReturn(Optional.of(product(1, "Red Rose", 100000)));
		when(wishlistItemRepository.findByUserIdAndProductId(1L, 1L)).thenReturn(Optional.empty());
		when(wishlistItemRepository.save(any(WishlistItem.class)))
			.thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/wishlist/me/1").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.added").value(true));
	}
}
