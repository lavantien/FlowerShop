package com.lavantien.flowershop.api.order;

import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.coupon.Coupon;
import com.lavantien.flowershop.api.coupon.CouponKind;
import com.lavantien.flowershop.api.coupon.CouponRepository;
import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.payment.PaymentController;
import com.lavantien.flowershop.api.payment.PaymentSession;
import com.lavantien.flowershop.api.payment.PaymentSessionRepository;
import com.lavantien.flowershop.api.payment.PaymentStatus;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import com.lavantien.flowershop.service.CouponService;
import com.lavantien.flowershop.service.GeoService;
import com.lavantien.flowershop.service.OrderService;
import com.lavantien.flowershop.service.PaymentService;
import com.lavantien.flowershop.service.ShopProperties;
import com.lavantien.flowershop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderControllerTest {
	private static final ShopProperties PROPERTIES = new ShopProperties(
		new ShopProperties.Delivery(20000, 5000, 200000, 1000),
		new ShopProperties.Payment("dev-only-secret", "/pay"));

	private OrderRepository orderRepository;
	private OrderItemRepository orderItemRepository;
	private ProductRepository productRepository;
	private BranchRepository branchRepository;
	private StockLevelRepository stockLevelRepository;
	private GeoService geoService;
	private PaymentSessionRepository paymentSessionRepository;
	private PaymentService paymentService;
	private CouponRepository couponRepository;
	private UserRepository userRepository;
	private UserService userService;
	private MockMvc mockMvc;
	private PaymentSession stubbedPayment;

	@BeforeEach
	void setUp() {
		orderRepository = mock(OrderRepository.class);
		orderItemRepository = mock(OrderItemRepository.class);
		productRepository = mock(ProductRepository.class);
		branchRepository = mock(BranchRepository.class);
		stockLevelRepository = mock(StockLevelRepository.class);
		geoService = mock(GeoService.class);
		paymentSessionRepository = mock(PaymentSessionRepository.class);
		paymentService = new PaymentService(PROPERTIES);
		couponRepository = mock(CouponRepository.class);
		userRepository = mock(UserRepository.class);
		userService = new UserService();
		OrderService orderService = new OrderService(orderRepository, orderItemRepository, productRepository,
			branchRepository, stockLevelRepository, paymentSessionRepository, paymentService, geoService,
			new CouponService(couponRepository), PROPERTIES);
		mockMvc = MockMvcBuilders
			.standaloneSetup(new OrderController(orderRepository, orderService), new PaymentController(orderService))
			.addInterceptors(new TokenInterceptor(userRepository, userService))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
		prime(userRepository, userService, persona(1, Role.ADMIN, "admin@flowershop.example"));
		prime(userRepository, userService, persona(4, Role.USER, "member@flowershop.example"));
	}

	private static Product product(long id, String name, long price) {
		Product product = new Product(name, "demo", "https://cdn.example/x.jpg", BigDecimal.valueOf(price),
			"T", "C");
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
		when(paymentSessionRepository.save(any(PaymentSession.class)))
			.thenAnswer(invocation -> invocation.getArgument(0));
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
			.andExpect(jsonPath("$.order.id").value(77))
			.andExpect(jsonPath("$.order.userId").value(4))
			.andExpect(jsonPath("$.order.status").value("PENDING"))
			.andExpect(jsonPath("$.order.placedAt").isNotEmpty())
			.andExpect(jsonPath("$.order.paidAt").value(nullValue()))
			.andExpect(jsonPath("$.order.phone").value("0900000001"))
			.andExpect(jsonPath("$.order.address").value("01 Demo Lane"))
			.andExpect(jsonPath("$.order.district").value("Quận 1"))
			.andExpect(jsonPath("$.order.city").value("Hồ Chí Minh"))
			.andExpect(jsonPath("$.order.branchId").value(3))
			.andExpect(jsonPath("$.order.branchName").value("Binh Thanh Hub"))
			.andExpect(jsonPath("$.order.distanceKm").value(4.2))
			.andExpect(jsonPath("$.order.deliveryFee").value(40000))
			.andExpect(jsonPath("$.order.couponCode").value(nullValue()))
			.andExpect(jsonPath("$.order.discountAmount").value(0))
			.andExpect(jsonPath("$.order.subtotal").value(350000))
			.andExpect(jsonPath("$.order.total").value(390000))
			.andExpect(jsonPath("$.order.items.length()").value(2))
			.andExpect(jsonPath("$.order.items[0].productId").value(1))
			.andExpect(jsonPath("$.order.items[0].productName").value("Red Rose"))
			.andExpect(jsonPath("$.order.items[0].unitPrice").value(100000))
			.andExpect(jsonPath("$.order.items[0].quantity").value(2))
			.andExpect(jsonPath("$.order.items[0].lineTotal").value(200000))
			.andExpect(jsonPath("$.order.items[1].productId").value(2))
			.andExpect(jsonPath("$.order.items[1].lineTotal").value(150000));

		ArgumentCaptor<Order> saved = ArgumentCaptor.forClass(Order.class);
		verify(orderRepository).save(saved.capture());
		assertEquals(OrderStatus.PENDING, saved.getValue().getStatus());
		assertNotNull(saved.getValue().getPlacedAt());
		assertEquals(0, saved.getValue().getTotal().scale());

		// The payment block is signed over the session this transaction saved.
		ArgumentCaptor<PaymentSession> session = ArgumentCaptor.forClass(PaymentSession.class);
		verify(paymentSessionRepository).save(session.capture());
		assertEquals(PaymentStatus.PENDING, session.getValue().getStatus());
		assertEquals(77L, session.getValue().getOrderId());
		assertEquals(0, session.getValue().getAmount().scale());
	}

	@Test
	void checkoutOpensThePaymentSessionAndReturnsTheSignedRedirect() throws Exception {
		stubHappyCheckout();

		String body = mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content(memberCheckoutBody()))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.payment.id").isNotEmpty())
			.andReturn().getResponse().getContentAsString();

		String paymentId = JsonPath.read(body, "$.payment.id");
		String redirectUrl = JsonPath.read(body, "$.payment.redirectUrl");
		ArgumentCaptor<PaymentSession> session = ArgumentCaptor.forClass(PaymentSession.class);
		verify(paymentSessionRepository).save(session.capture());
		assertEquals(paymentId, session.getValue().getId());
		assertEquals("/pay/" + paymentId + "?sig=" + paymentService.sign(session.getValue()), redirectUrl);
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
			.andExpect(jsonPath("$.order.items.length()").value(1))
			.andExpect(jsonPath("$.order.items[0].quantity").value(3))
			.andExpect(jsonPath("$.order.items[0].lineTotal").value(300000));

		verify(stockLevelRepository, times(1)).decrementIfAvailable(anyLong(), eq(3));
	}

	private static Coupon coupon(String code, CouponKind kind, String value, boolean active) {
		return new Coupon(code, kind, new BigDecimal(value), active, null);
	}

	@Test
	void checkoutAppliesAnActivePercentCouponOnTopOfTheFee() throws Exception {
		stubHappyCheckout();
		when(couponRepository.findByCode("WELCOME10"))
			.thenReturn(Optional.of(coupon("WELCOME10", CouponKind.PERCENT, "10", true)));

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
			.andExpect(jsonPath("$.order.couponCode").value("WELCOME10"))
			.andExpect(jsonPath("$.order.discountAmount").value(20000))
			.andExpect(jsonPath("$.order.subtotal").value(200000))
			.andExpect(jsonPath("$.order.total").value(220000));

		ArgumentCaptor<PaymentSession> session = ArgumentCaptor.forClass(PaymentSession.class);
		verify(paymentSessionRepository).save(session.capture());
		assertEquals(0, BigDecimal.valueOf(220000).compareTo(session.getValue().getAmount()),
			"the payment must charge the post-discount total");
	}

	@Test
	void checkoutRoundsTheCouponDiscountToTheMoneyStep() throws Exception {
		stubHappyCheckout();
		when(productRepository.findAllById(any())).thenReturn(List.of(product(1, "Red Rose", 127778)));
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 1L))
			.thenReturn(Optional.of(stockLevel(3, 1, 5)));
		when(couponRepository.findByCode("ODD10"))
			.thenReturn(Optional.of(coupon("ODD10", CouponKind.PERCENT, "10", true)));

		// subtotal 255556, ceil of the tenth is 25556, HALF_UP to 1000 is 26000,
		// so the total is 255556 - 26000 + 40000.
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
						"couponCode": "ODD10"
					}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.order.discountAmount").value(26000))
			.andExpect(jsonPath("$.order.total").value(269556));
	}

	@Test
	void checkoutClampsAFixedCouponToTheSubtotal() throws Exception {
		stubHappyCheckout();
		when(couponRepository.findByCode("SHIP150K"))
			.thenReturn(Optional.of(coupon("SHIP150K", CouponKind.FIXED, "150000", true)));

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3,
						"couponCode": "SHIP150K"
					}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.order.discountAmount").value(100000))
			.andExpect(jsonPath("$.order.total").value(40000));
	}

	@Test
	void checkoutAnswers404ForAnUnknownCouponCode() throws Exception {
		stubHappyCheckout();
		when(couponRepository.findByCode("NOPE")).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3,
						"couponCode": "NOPE"
					}
					"""))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));

		verify(orderRepository, never()).save(any(Order.class));
	}

	@Test
	void checkoutConflictsForAnInactiveCoupon() throws Exception {
		stubHappyCheckout();
		when(couponRepository.findByCode("EXPIRED5"))
			.thenReturn(Optional.of(coupon("EXPIRED5", CouponKind.PERCENT, "5", false)));

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3,
						"couponCode": "EXPIRED5"
					}
					"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("COUPON_INACTIVE"));

		verify(orderRepository, never()).save(any(Order.class));
	}

	@Test
	void checkoutConflictsForAnExpiredCoupon() throws Exception {
		stubHappyCheckout();
		when(couponRepository.findByCode("OLD1")).thenReturn(Optional
			.of(new Coupon("OLD1", CouponKind.PERCENT, new BigDecimal("5"), true,
				Instant.parse("2020-01-01T00:00:00Z"))));

		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3,
						"couponCode": "OLD1"
					}
					"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("COUPON_INACTIVE"));

		verify(orderRepository, never()).save(any(Order.class));
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
			.andExpect(jsonPath("$.order.branchId").value(9))
			.andExpect(jsonPath("$.order.branchName").value("District 1 Kiosk"));

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
	void checkoutRefusesAnExplicitlyInactiveBranch() throws Exception {
		stubHappyCheckout();
		Branch inactive = branch(3, "Binh Thanh Hub");
		inactive.setActive(false);
		when(branchRepository.findById(3L)).thenReturn(Optional.of(inactive));

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
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("NOT_FOUND"))
			.andExpect(jsonPath("$.detail").value(containsString("no active branch")));

		verify(orderRepository, never()).save(any(Order.class));
	}

	@Test
	void checkoutRefusesALegacyCoordinateLessBranchInsteadOfA500() throws Exception {
		stubHappyCheckout();
		Branch legacy = branch(3, "Binh Thanh Hub");
		legacy.setLat(null);
		when(branchRepository.findById(3L)).thenReturn(Optional.of(legacy));

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
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));

		verify(orderRepository, never()).save(any(Order.class));
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
	void checkoutTakesStockRowLocksInProductIdOrder() throws Exception {
		stubHappyCheckout();

		// The request names product 2 first: whatever the cart order, the
		// decrement must visit the stock rows lowest product id first so
		// opposing paths can never deadlock on mirrored row locks.
		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 2, "quantity": 3}, {"productId": 1, "quantity": 2}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "Hồ Chí Minh",
						"branchId": 3
					}
					"""))
			.andExpect(status().isCreated());

		InOrder order = inOrder(stockLevelRepository);
		order.verify(stockLevelRepository).decrementIfAvailable(3001L, 2);
		order.verify(stockLevelRepository).decrementIfAvailable(3002L, 3);
	}

	@Test
	void restoreStockTakesStockRowLocksInProductIdOrder() throws Exception {
		stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);
		// The item rows come back highest product id first: the restore must
		// still visit the rows lowest product id first, mirroring checkout.
		when(orderItemRepository.findByOrderId(12L)).thenReturn(List.of(
			item(502, 12, 2, "White Tulip", 50000, 3), item(501, 12, 1, "Red Rose", 100000, 2)));
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 2L))
			.thenReturn(Optional.of(stockLevel(3, 2, 5)));

		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk());

		InOrder order = inOrder(stockLevelRepository);
		order.verify(stockLevelRepository).increment(3001L, 2);
		order.verify(stockLevelRepository).increment(3002L, 3);
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
	void anOverflowingPageAnswersAnEmptyPageNotA500() throws Exception {
		when(orderRepository.findByUserId(eq(4L), any(Pageable.class)))
			.thenReturn(new PageImpl<>(List.of(), PageRequest.of(44739241, 48), 0));

		mockMvc.perform(get("/api/order/me").header("X-Auth-Token", tokenOf(4, Role.USER))
				.queryParam("page", "2147483647").queryParam("size", "48"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content").isEmpty())
			.andExpect(jsonPath("$.totalElements").value(0));

		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
		verify(orderRepository).findByUserId(eq(4L), pageable.capture());
		assertTrue(pageable.getValue().getOffset() + pageable.getValue().getPageSize() <= Integer.MAX_VALUE,
			"the pageable handed to Spring Data must keep its offset inside int range");
	}

	@Test
	void checkoutRejectsAStringPastTheColumnWidthInsteadOfTruncatingAtTheDatabase() throws Exception {
		mockMvc.perform(post("/api/order").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"items": [{"productId": 1, "quantity": 1}],
						"phone": "0900000001",
						"address": "01 Demo Lane",
						"district": "Quận 1",
						"city": "%s"
					}
					""".formatted("x".repeat(256))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.errors.city").value("size must be between 0 and 255"));

		verify(orderRepository, never()).save(any(Order.class));
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
		assertNull(OrderController.parseInstant(" ", false));
		assertNull(OrderController.parseInstant(null, true));
		assertNull(OrderController.parseInstant("2026-13-45", false));
		assertNull(OrderController.parseInstant("not a date", true));
		assertEquals(OrderStatus.PAID, OrderController.parseStatus("paid"));
		assertEquals(OrderStatus.SHIPPED, OrderController.parseStatus(" SHIPPED "));
		assertEquals(Instant.parse("2026-10-07T00:00:00Z"), OrderController.parseInstant("2026-10-07", false));
		assertEquals(Instant.parse("2026-10-08T00:00:00Z"), OrderController.parseInstant("2026-10-07", true));
	}

	@Test
	void adminListsOrdersWithoutADateWindow() throws Exception {
		when(orderRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(
			new PageImpl<>(List.of(order(12, 4, OrderStatus.PENDING)), PageRequest.of(0, 12), 1));
		when(orderItemRepository.findByOrderId(12L)).thenReturn(List.of(item(501, 12, 1, "Red Rose", 100000, 2)));
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch(3, "Binh Thanh Hub")));

		mockMvc.perform(get("/api/order").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content[0].id").value(12));
	}

	@Test
	void aBranchlessOrderViewRendersANullBranchName() throws Exception {
		Order branchless = new Order(4L, "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh",
			null, null, null, null, BigDecimal.ZERO, BigDecimal.valueOf(350000),
			BigDecimal.valueOf(390000));
		branchless.setId(12L);
		branchless.setStatus(OrderStatus.PENDING);
		branchless.setPlacedAt(Instant.parse("2026-10-07T04:00:00Z"));
		when(orderRepository.findById(12L)).thenReturn(Optional.of(branchless));
		when(orderItemRepository.findByOrderId(12L)).thenReturn(List.of(
			item(501, 12, 1, "Red Rose", 100000, 2)));

		mockMvc.perform(get("/api/order/12").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.branchId").value(nullValue()))
			.andExpect(jsonPath("$.branchName").value(nullValue()))
			.andExpect(jsonPath("$.deliveryFee").value(nullValue()));
	}

	@Test
	void orderDetailCarriesTheBranchNameResolvedThroughTheViewPath() throws Exception {
		when(orderRepository.findById(12L)).thenReturn(Optional.of(order(12, 4, OrderStatus.PENDING)));
		when(orderItemRepository.findByOrderId(12L)).thenReturn(List.of(item(501, 12, 1, "Red Rose", 100000, 2)));
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch(3, "Binh Thanh Hub")));

		mockMvc.perform(get("/api/order/12").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.branchId").value(3))
			.andExpect(jsonPath("$.branchName").value("Binh Thanh Hub"));
	}

	@Test
	void changingTheStatusOfAnUnknownOrderIsANotFound() throws Exception {
		when(paymentSessionRepository.lockByOrderId(404L)).thenReturn(Optional.empty());
		when(orderRepository.lockById(404L)).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/order/404/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"SHIPPED\"}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void cancellingRestoresThroughAFreshRowWhenTheStockRowIsGone() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 1L)).thenReturn(Optional.empty());
		when(stockLevelRepository.save(any(StockLevel.class))).thenAnswer(invocation -> invocation.getArgument(0));

		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertEquals(OrderStatus.CANCELLED, order.getStatus());
		ArgumentCaptor<StockLevel> saved = ArgumentCaptor.forClass(StockLevel.class);
		verify(stockLevelRepository).save(saved.capture());
		assertEquals(null, saved.getValue().getId(), "a fresh row must let the database assign the id");
		assertEquals(3L, saved.getValue().getBranchId());
		assertEquals(1L, saved.getValue().getProductId());
		assertEquals(2, saved.getValue().getQuantity(), "the whole cancelled quantity comes back");
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

	private Order stubCancellableOrder(OrderStatus status, PaymentStatus paymentStatus) {
		Order order = order(12, 4, status);
		when(orderRepository.lockById(12L)).thenReturn(Optional.of(order));
		PaymentSession session = new PaymentSession("pid-1", 12L, BigDecimal.valueOf(390000));
		if (paymentStatus == PaymentStatus.CONFIRMED) {
			session.confirm(Instant.parse("2026-10-07T05:00:00Z"));
		} else if (paymentStatus == PaymentStatus.CANCELLED) {
			session.cancel(Instant.now());
		}
		stubbedPayment = session;
		when(paymentSessionRepository.lockByOrderId(12L)).thenReturn(Optional.of(session));
		when(orderItemRepository.findByOrderId(12L))
			.thenReturn(List.of(item(501, 12, 1, "Red Rose", 100000, 2)));
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch(3, "Binh Thanh Hub")));
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 1L))
			.thenReturn(Optional.of(stockLevel(3, 1, 5)));
		when(stockLevelRepository.increment(anyLong(), anyInt())).thenReturn(1);
		return order;
	}

	@Test
	void theOwnerCancelsAPendingOrderRestoringStockAndKillingThePayment() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);

		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"))
			.andExpect(jsonPath("$.cancelledAt").isNotEmpty());

		assertEquals(OrderStatus.CANCELLED, order.getStatus());
		assertEquals(PaymentStatus.CANCELLED,
			paymentSessionRepository.lockByOrderId(12L).orElseThrow().getStatus());
		verify(stockLevelRepository).increment(3001L, 2);
	}

	@Test
	void theOwnerCancelsAPendingOrderThatHasNoPaymentSessionOnRecord() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);
		when(paymentSessionRepository.lockByOrderId(12L)).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertEquals(OrderStatus.CANCELLED, order.getStatus());
		verify(stockLevelRepository).increment(3001L, 2);
	}

	@Test
	void theOwnerCannotCancelAPaidOrder() throws Exception {
		stubCancellableOrder(OrderStatus.PAID, PaymentStatus.CONFIRMED);

		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(4, Role.USER)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ILLEGAL_TRANSITION"));

		verify(stockLevelRepository, never()).increment(anyLong(), anyInt());
	}

	@Test
	void anAdminCancelsAPaidOrderAndRestoresTheStock() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.PAID, PaymentStatus.CONFIRMED);

		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertEquals(OrderStatus.CANCELLED, order.getStatus());
		verify(stockLevelRepository).increment(3001L, 2);
	}

	@Test
	void neitherRoleMayCancelAShippedOrTerminalOrder() throws Exception {
		stubCancellableOrder(OrderStatus.SHIPPED, PaymentStatus.CONFIRMED);
		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ILLEGAL_TRANSITION"));

		stubCancellableOrder(OrderStatus.COMPLETED, PaymentStatus.CONFIRMED);
		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isConflict());

		stubCancellableOrder(OrderStatus.CANCELLED, PaymentStatus.CANCELLED);
		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isConflict());
	}

	@Test
	void aStrangerCannotCancelSomeoneElsesOrder() throws Exception {
		prime(userRepository, userService, persona(5, Role.USER, "stranger@flowershop.example"));
		stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);

		mockMvc.perform(post("/api/order/12/cancel").header("X-Auth-Token", tokenOf(5, Role.USER)))
			.andExpect(status().isForbidden());
	}

	@Test
	void cancellingAnUnknownOrderIsANotFound() throws Exception {
		when(paymentSessionRepository.lockByOrderId(404L)).thenReturn(Optional.empty());
		when(orderRepository.lockById(404L)).thenReturn(Optional.empty());

		mockMvc.perform(post("/api/order/404/cancel").header("X-Auth-Token", tokenOf(1, Role.ADMIN)))
			.andExpect(status().isNotFound());
	}

	@Test
	void theAdminShipsAPaidOrderWithoutTouchingStock() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.PAID, PaymentStatus.CONFIRMED);

		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"SHIPPED\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("SHIPPED"))
			.andExpect(jsonPath("$.shippedAt").isNotEmpty());

		assertEquals(OrderStatus.SHIPPED, order.getStatus());
		verify(stockLevelRepository, never()).increment(anyLong(), anyInt());
	}

	@Test
	void theAdminCompletesAShippedOrder() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.SHIPPED, PaymentStatus.CONFIRMED);

		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"COMPLETED\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("COMPLETED"));

		assertEquals(OrderStatus.COMPLETED, order.getStatus());
	}

	@Test
	void theAdminCannotForceAnOrderToPaidOrRepeatATerminalStatus() throws Exception {
		stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);
		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"PAID\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ILLEGAL_TRANSITION"));

		stubCancellableOrder(OrderStatus.COMPLETED, PaymentStatus.CONFIRMED);
		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"SHIPPED\"}"))
			.andExpect(status().isConflict());
	}

	@Test
	void theAdminCancelsAPaidOrderThroughTheStatusEndpointAndRestoresStock() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.PAID, PaymentStatus.CONFIRMED);

		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"CANCELLED\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertEquals(OrderStatus.CANCELLED, order.getStatus());
		verify(stockLevelRepository).increment(3001L, 2);
	}

	@Test
	void theAdminCancelsAPendingOrderThroughTheStatusEndpointAndKillsThePayment() throws Exception {
		Order order = stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);

		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"CANCELLED\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertEquals(OrderStatus.CANCELLED, order.getStatus());
		assertEquals(PaymentStatus.CANCELLED, stubbedPayment.getStatus(),
			"an admin status-cancel must kill the pending payment, else a later confirm charges a cancelled order");
		verify(stockLevelRepository).increment(3001L, 2);
	}

	@Test
	void confirmingAPaymentAfterAnAdminStatusCancelAnswers409() throws Exception {
		stubCancellableOrder(OrderStatus.PENDING, PaymentStatus.PENDING);
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(stubbedPayment));

		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(1, Role.ADMIN))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"CANCELLED\"}"))
			.andExpect(status().isOk());

		mockMvc.perform(post("/api/payment/pid-1/confirm")
				.queryParam("sig", paymentService.sign(stubbedPayment)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("PAYMENT_CANCELLED"));
	}

	@Test
	void membersCannotDriveTheStatusEndpoint() throws Exception {
		mockMvc.perform(post("/api/order/12/status").header("X-Auth-Token", tokenOf(4, Role.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\": \"SHIPPED\"}"))
			.andExpect(status().isForbidden());
	}
}
