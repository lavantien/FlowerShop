package com.lavantien.flowershop.api.order;

import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.GeoService;
import com.lavantien.flowershop.service.OrderService;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
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
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderControllerTest {
	private OrderRepository orderRepository;
	private OrderItemRepository orderItemRepository;
	private ProductRepository productRepository;
	private BranchRepository branchRepository;
	private StockLevelRepository stockLevelRepository;
	private GeoService geoService;
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		orderRepository = mock(OrderRepository.class);
		orderItemRepository = mock(OrderItemRepository.class);
		productRepository = mock(ProductRepository.class);
		branchRepository = mock(BranchRepository.class);
		stockLevelRepository = mock(StockLevelRepository.class);
		geoService = mock(GeoService.class);
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		OrderService orderService = new OrderService(orderRepository, orderItemRepository, productRepository,
			branchRepository, stockLevelRepository, geoService);
		mockMvc = MockMvcBuilders.standaloneSetup(new OrderController(orderRepository, orderService))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
	}

	private static Product product(long id, String name, long price) {
		Product product = new Product(name, "demo", "https://cdn.example/x.jpg", BigDecimal.valueOf(price),
			null, null, "T", "C");
		product.setId(id);
		return product;
	}

	private static Branch branch(long id, String name) {
		Branch branch = new Branch(name, "01 Dien Bien Phu", "Binh Thanh", "Ho Chi Minh", 10.798, 106.7105, true);
		branch.setId(id);
		return branch;
	}

	private static StockLevel stockLevel(long branchId, long productId, int quantity) {
		StockLevel row = new StockLevel();
		row.setId(branchId * 1000 + productId);
		row.setBranchId(branchId);
		row.setProductId(productId);
		row.setQuantity(quantity);
		return row;
	}

	private static OrderItem item(long id, long orderId, long productId, String name, long price, int quantity) {
		OrderItem item = new OrderItem(orderId, productId, name, BigDecimal.valueOf(price), quantity,
			BigDecimal.valueOf(price * quantity));
		item.setId(id);
		return item;
	}

	private static Order order(long id, long userId, OrderStatus status) {
		Order order = new Order(userId, "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh", 3L, 4.2,
			BigDecimal.valueOf(40000), null, BigDecimal.ZERO, BigDecimal.valueOf(350000),
			BigDecimal.valueOf(390000));
		order.setId(id);
		order.setStatus(status);
		order.setPlacedAt(Instant.parse("2026-10-07T04:00:00Z"));
		return order;
	}

	private void stubHappyCheckout() {
		when(productRepository.findAllById(any())).thenReturn(List.of(
			product(1, "Red Rose", 100000), product(2, "White Tulip", 50000)));
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch(3, "Binh Thanh Hub")));
		when(geoService.resolve("Quận 1", "Hồ Chí Minh")).thenReturn(new GeoService.Point(10.775, 106.705));
		when(geoService.distanceKm(any(GeoService.Point.class), any(GeoService.Point.class))).thenReturn(4.2);
		when(geoService.deliveryFee(4.2)).thenReturn(40000L);
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 1L))
			.thenReturn(Optional.of(stockLevel(3, 1, 5)));
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 2L))
			.thenReturn(Optional.of(stockLevel(3, 2, 5)));
		when(stockLevelRepository.decrementIfAvailable(anyLong(), anyInt())).thenReturn(1);
		when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
			Order order = invocation.getArgument(0);
			order.setId(77L);
			return order;
		});
		when(orderItemRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
	}

	private String memberCheckoutBody() {
		return """
			{
				"items": [{"productId": 1, "quantity": 2}, {"productId": 2, "quantity": 3}],
				"phone": "0900000001",
				"address": "01 Demo Lane",
				"district": "Quận 1",
				"city": "Hồ Chí Minh",
				"branchId": 3
			}
			""";
	}

	@Test
	void memberChecksOutWithServerPricingSnapshotsAndTheStockGuard() throws Exception {
		stubHappyCheckout();

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content(memberCheckoutBody()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").value(77))
			.andExpect(jsonPath("$.userId").value(4))
			.andExpect(jsonPath("$.status").value("PENDING"))
			.andExpect(jsonPath("$.placedAt").isNotEmpty())
			.andExpect(jsonPath("$.paidAt").value(nullValue()))
			.andExpect(jsonPath("$.phone").value("0900000001"))
			.andExpect(jsonPath("$.address").value("01 Demo Lane"))
			.andExpect(jsonPath("$.district").value("Quận 1"))
			.andExpect(jsonPath("$.city").value("Hồ Chí Minh"))
			.andExpect(jsonPath("$.branchId").value(3))
			.andExpect(jsonPath("$.branchName").value("Binh Thanh Hub"))
			.andExpect(jsonPath("$.distanceKm").value(4.2))
			.andExpect(jsonPath("$.deliveryFee").value(40000))
			.andExpect(jsonPath("$.couponCode").value(nullValue()))
			.andExpect(jsonPath("$.discountAmount").value(0))
			.andExpect(jsonPath("$.subtotal").value(350000))
			.andExpect(jsonPath("$.total").value(390000))
			.andExpect(jsonPath("$.items.length()").value(2))
			.andExpect(jsonPath("$.items[0].productId").value(1))
			.andExpect(jsonPath("$.items[0].productName").value("Red Rose"))
			.andExpect(jsonPath("$.items[0].unitPrice").value(100000))
			.andExpect(jsonPath("$.items[0].quantity").value(2))
			.andExpect(jsonPath("$.items[0].lineTotal").value(200000))
			.andExpect(jsonPath("$.items[1].productId").value(2))
			.andExpect(jsonPath("$.items[1].lineTotal").value(150000));

		ArgumentCaptor<Order> saved = ArgumentCaptor.forClass(Order.class);
		verify(orderRepository).save(saved.capture());
		assertEquals(OrderStatus.PENDING, saved.getValue().getStatus());
		assertNotNull(saved.getValue().getPlacedAt());
		assertEquals(0, saved.getValue().getTotal().scale());
	}

	@Test
	void duplicateLinesMergeIntoOneItemAndOneDecrement() throws Exception {
		stubHappyCheckout();
		when(productRepository.findAllById(any())).thenReturn(List.of(product(1, "Red Rose", 100000)));

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}, {"productId": 1, "quantity": 2}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3
					}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.items.length()").value(1))
			.andExpect(jsonPath("$.items[0].quantity").value(3))
			.andExpect(jsonPath("$.items[0].lineTotal").value(300000));

		verify(stockLevelRepository, times(1)).decrementIfAvailable(anyLong(), eq(3));
	}

	@Test
	void theCouponCodeIsStoredWhileTheDiscountStaysZeroUntilCouponsLand() throws Exception {
		stubHappyCheckout();

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 2}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3,
						"couponCode": "WELCOME10"
					}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.couponCode").value("WELCOME10"))
			.andExpect(jsonPath("$.discountAmount").value(0))
			.andExpect(jsonPath("$.total").value(240000));
	}

	@Test
	void withoutABranchIdTheNearestActiveBranchIsResolved() throws Exception {
		stubHappyCheckout();
		Branch nearest = branch(9, "District 1 Kiosk");
		when(branchRepository.findAll()).thenReturn(List.of(branch(3, "Binh Thanh Hub"), nearest));
		when(geoService.nearestBranch(any(), any(GeoService.Point.class))).thenReturn(nearest);
		when(stockLevelRepository.findByBranchIdAndProductId(9L, 1L))
			.thenReturn(Optional.of(stockLevel(9, 1, 5)));

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh"
					}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.branchId").value(9))
			.andExpect(jsonPath("$.branchName").value("District 1 Kiosk"));

		verify(geoService).resolve("Quận 1", "Hồ Chí Minh");
	}

	@Test
	void noEligibleBranchLeavesCheckoutImpossible() throws Exception {
		stubHappyCheckout();
		when(branchRepository.findAll()).thenReturn(List.of());
		when(geoService.nearestBranch(any(), any())).thenReturn(null);

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh"
					}
					"""))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void unknownBranchIsANotFound() throws Exception {
		stubHappyCheckout();
		when(branchRepository.findById(66L)).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 66
					}
					"""))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void unknownProductIsANotFound() throws Exception {
		stubHappyCheckout();
		when(productRepository.findAllById(any())).thenReturn(List.of());

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 404, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3
					}
					"""))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("no product with id 404"));
	}

	@Test
	void aShortfallRollsTheCartBackAndNamesEveryFailingItem() throws Exception {
		stubHappyCheckout();
		when(stockLevelRepository.decrementIfAvailable(3001L, 2)).thenReturn(1);
		when(stockLevelRepository.decrementIfAvailable(3002L, 3)).thenReturn(0);

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content(memberCheckoutBody()))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("OUT_OF_STOCK"))
			.andExpect(jsonPath("$.detail").value(containsString("White Tulip")));

		verify(orderRepository, never()).save(any(Order.class));
	}

	@Test
	void aMissingStockRowCountsAsOutOfStock() throws Exception {
		stubHappyCheckout();
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 1L)).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3
					}
					"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("OUT_OF_STOCK"))
			.andExpect(jsonPath("$.detail").value(containsString("Red Rose")));
	}

	@Test
	void anonymousCheckoutIsRejected() throws Exception {
		mockMvc.perform(post("/api/order").contentType(MediaType.APPLICATION_JSON).content(memberCheckoutBody()))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void validationRejectsAnEmptyCartAndBlankAddressFields() throws Exception {
		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [],
						"phone": " ",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh"
					}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.items").value("must not be empty"))
			.andExpect(jsonPath("$.errors.phone").value("must not be blank"));
	}

	@Test
	void validationRejectsNonPositiveAndAbsurdQuantities() throws Exception {
		for (String quantity : new String[]{"0", "10001"}) {
			mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
						{
							"items": [{"productId": 1, "quantity": %s}],
							"phone": "0900000001",
							"address": "01 Demo Lane",
							"district": "Quận 1",
							"city": "Hồ Chí Minh"
						}
						""".formatted(quantity)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION"))
				.andExpect(jsonPath("$.errors['items[0].quantity']").exists());
		}
	}

	@Test
	void myOrdersServesTheCallerNewestFirstWithClampedPaging() throws Exception {
		when(orderRepository.findByUserId(eq(4L), any(Pageable.class))).thenReturn(
			new PageImpl<>(List.of(order(12, 4, OrderStatus.PAID), order(11, 4, OrderStatus.PENDING)),
				PageRequest.of(0, 2), 2));
		when(orderItemRepository.findByOrderId(anyLong())).thenReturn(List.of(item(501, 12, 1, "Red Rose", 100000, 2)));
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch(3, "Binh Thanh Hub")));

		mockMvc.perform(get("/api/order/me").header("X-Auth-Token", tokenOf(4, Role.USER))
				.queryParam("page", "-4").queryParam("size", "0"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content.length()").value(2))
			.andExpect(jsonPath("$.content[0].id").value(12))
			.andExpect(jsonPath("$.content[1].id").value(11))
			.andExpect(jsonPath("$.content[0].status").value("PAID"))
			.andExpect(jsonPath("$.totalElements").value(2))
			.andExpect(jsonPath("$.page").value(0))
			.andExpect(jsonPath("$.size").value(2));

		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
		verify(orderRepository).findByUserId(eq(4L), pageable.capture());
		assertEquals(0, pageable.getValue().getPageNumber());
		assertEquals(1, pageable.getValue().getPageSize());
		assertEquals("id: DESC", pageable.getValue().getSort().toString());
	}

	@Test
	void membersCannotListEveryOrder() throws Exception {
		mockMvc.perform(get("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isForbidden());
	}

	@Test
	void adminListsOrdersNewestFirstThroughTheFilterSpecification() throws Exception {
		when(orderRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(
			new PageImpl<>(List.of(order(12, 4, OrderStatus.PENDING)), PageRequest.of(0, 12), 1));
		when(orderItemRepository.findByOrderId(12L)).thenReturn(List.of(item(501, 12, 1, "Red Rose", 100000, 2)));
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch(3, "Binh Thanh Hub")));

		mockMvc.perform(get("/api/order").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.queryParam("status", "PENDING").queryParam("from", "2026-10-01").queryParam("to", "2026-10-07"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].id").value(12))
			.andExpect(jsonPath("$.totalElements").value(1));

		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
		verify(orderRepository).findAll(any(Specification.class), pageable.capture());
		assertEquals("id: DESC", pageable.getValue().getSort().toString());
	}

	@Test
	void garbageQueryFiltersFallBackToNoFilter() {
		assertNull(OrderController.parseStatus("SHREDDER"));
		assertNull(OrderController.parseStatus(" "));
		assertNull(OrderController.parseInstant("2026-13-45", false));
		assertNull(OrderController.parseInstant("not a date", true));
		assertEquals(OrderStatus.PAID, OrderController.parseStatus("paid"));
		assertEquals(OrderStatus.SHIPPED, OrderController.parseStatus(" SHIPPED "));
		assertEquals(Instant.parse("2026-10-07T00:00:00Z"), OrderController.parseInstant("2026-10-07", false));
		assertEquals(Instant.parse("2026-10-08T00:00:00Z"), OrderController.parseInstant("2026-10-07", true));
	}

	@Test
	void orderDetailIsOwnOrAdmin() throws Exception {
		when(orderRepository.findById(12L)).thenReturn(Optional.of(order(12, 4, OrderStatus.PENDING)));
		when(orderItemRepository.findByOrderId(12L)).thenReturn(List.of(item(501, 12, 1, "Red Rose", 100000, 2)));
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch(3, "Binh Thanh Hub")));

		mockMvc.perform(get("/api/order/12").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(12));

		mockMvc.perform(get("/api/order/12").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.items[0].productName").value("Red Rose"));
	}

	@Test
	void orderDetailRefusesStrangersAndUnknownIds() throws Exception {
		prime(userRepository, userService, persona(5, Role.USER, "stranger@flowershop.example"));
		when(orderRepository.findById(12L)).thenReturn(Optional.of(order(12, 4, OrderStatus.PENDING)));
		when(orderRepository.findById(404L)).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/order/12").header("X-Auth-Token", tokenOf(5, Role.USER)))
			.andExpect(status().isForbidden());

		mockMvc.perform(get("/api/order/404").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}
}
