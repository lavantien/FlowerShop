package com.lavantien.flowershop.api.payment;

import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.coupon.CouponRepository;
import com.lavantien.flowershop.api.error.ApiExceptionHandler;
import com.lavantien.flowershop.api.order.Order;
import com.lavantien.flowershop.api.order.OrderItem;
import com.lavantien.flowershop.api.order.OrderItemRepository;
import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.order.OrderStatus;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.security.TokenInterceptor;
import com.lavantien.flowershop.service.CouponService;
import com.lavantien.flowershop.service.GeoService;
import com.lavantien.flowershop.service.OrderService;
import com.lavantien.flowershop.service.PaymentService;
import com.lavantien.flowershop.service.ShopProperties;
import com.lavantien.flowershop.service.UserService;
import com.lavantien.flowershop.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PaymentControllerTest {
	private static final ShopProperties PROPERTIES = new ShopProperties(
		new ShopProperties.Delivery(20000, 5000, 200000, 1000),
		new ShopProperties.Payment("dev-only-secret", "/pay"));

	private OrderRepository orderRepository;
	private OrderItemRepository orderItemRepository;
	private BranchRepository branchRepository;
	private StockLevelRepository stockLevelRepository;
	private PaymentSessionRepository paymentSessionRepository;
	private PaymentService paymentService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		orderRepository = mock(OrderRepository.class);
		orderItemRepository = mock(OrderItemRepository.class);
		branchRepository = mock(BranchRepository.class);
		stockLevelRepository = mock(StockLevelRepository.class);
		paymentSessionRepository = mock(PaymentSessionRepository.class);
		paymentService = new PaymentService(PROPERTIES);
		OrderService orderService = new OrderService(orderRepository, orderItemRepository,
			mock(ProductRepository.class), branchRepository, stockLevelRepository, paymentSessionRepository,
			paymentService, mock(GeoService.class), new CouponService(mock(CouponRepository.class)),
			PROPERTIES);
		mockMvc = MockMvcBuilders.standaloneSetup(new PaymentController(orderService))
			.addInterceptors(new TokenInterceptor(mock(UserRepository.class), new UserService()))
			.setControllerAdvice(new ApiExceptionHandler())
			.build();
	}

	private static PaymentSession pendingSession() {
		return new PaymentSession("pid-1", 12L, BigDecimal.valueOf(390000));
	}

	private static Order pendingOrder() {
		Order order = new Order(4L, "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh", 3L, 4.2,
			BigDecimal.valueOf(40000), null, BigDecimal.ZERO, BigDecimal.valueOf(350000),
			BigDecimal.valueOf(390000));
		order.setId(12L);
		order.setStatus(OrderStatus.PENDING);
		order.setPlacedAt(Instant.parse("2026-10-07T04:00:00Z"));
		return order;
	}

	private void stubOrderViews() {
		when(orderItemRepository.findByOrderId(12L)).thenReturn(List.of(
			new OrderItem(12L, 1L, "Red Rose", BigDecimal.valueOf(100000), 2, BigDecimal.valueOf(200000))));
		Branch branch = new Branch("Binh Thanh Hub", "01 Dien Bien Phu", "Binh Thanh", "Ho Chi Minh",
			10.798, 106.7105, true);
		branch.setId(3L);
		when(branchRepository.findById(3L)).thenReturn(Optional.of(branch));
	}

	private void stubStockRow() {
		StockLevel row = new StockLevel(3L, 1L, 1);
		row.setId(3001L);
		when(stockLevelRepository.findByBranchIdAndProductId(3L, 1L)).thenReturn(Optional.of(row));
		when(stockLevelRepository.increment(anyLong(), anyInt())).thenReturn(1);
	}

	@Test
	void theGatewayPageShowsTheSessionBehindAValidSignature() throws Exception {
		PaymentSession session = pendingSession();
		when(paymentSessionRepository.findById("pid-1")).thenReturn(Optional.of(session));

		mockMvc.perform(get("/api/payment/pid-1").queryParam("sig", paymentService.sign(session)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.paymentId").value("pid-1"))
			.andExpect(jsonPath("$.orderId").value(12))
			.andExpect(jsonPath("$.amount").value(390000))
			.andExpect(jsonPath("$.status").value("PENDING"))
			.andExpect(jsonPath("$.summary").value("payment of 390000 VND for order 12"));
	}

	@Test
	void aForgedMissingOrCrossSessionSignatureIsRejected() throws Exception {
		PaymentSession session = pendingSession();
		when(paymentSessionRepository.findById("pid-1")).thenReturn(Optional.of(session));
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(session));
		String sig = paymentService.sign(session);
		String forged = (sig.charAt(0) == '0' ? "1" : "0") + sig.substring(1);
		String cross = paymentService.sign(new PaymentSession("pid-2", 12L, BigDecimal.valueOf(390000)));

		mockMvc.perform(get("/api/payment/pid-1").queryParam("sig", forged))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/payment/pid-1"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/payment/pid-1").queryParam("sig", cross))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/payment/pid-1/confirm").queryParam("sig", forged))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void anUnknownPaymentIdIsANotFound() throws Exception {
		when(paymentSessionRepository.findById("nobody")).thenReturn(Optional.empty());

		mockMvc.perform(get("/api/payment/nobody").queryParam("sig", "00"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void confirmFlipsThePaymentAndTheOrderInOneGo() throws Exception {
		PaymentSession session = pendingSession();
		Order order = pendingOrder();
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(session));
		when(orderRepository.lockById(12L)).thenReturn(Optional.of(order));

		mockMvc.perform(post("/api/payment/pid-1/confirm").queryParam("sig", paymentService.sign(session)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.orderId").value(12))
			.andExpect(jsonPath("$.status").value("CONFIRMED"));

		assertEquals(PaymentStatus.CONFIRMED, session.getStatus());
		assertNotNull(session.getConfirmedAt());
		assertEquals(OrderStatus.PAID, order.getStatus());
		assertNotNull(order.getPaidAt());
	}

	@Test
	void confirmIsIdempotentAndNeverTouchesAPaidOrderTwice() throws Exception {
		PaymentSession session = pendingSession();
		session.confirm(Instant.parse("2026-10-07T05:00:00Z"));
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(session));

		mockMvc.perform(post("/api/payment/pid-1/confirm").queryParam("sig", paymentService.sign(session)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CONFIRMED"));

		assertEquals(Instant.parse("2026-10-07T05:00:00Z"), session.getConfirmedAt());
		verify(orderRepository, never()).lockById(anyLong());
	}

	@Test
	void confirmOnACancelledPaymentIsAConflict() throws Exception {
		PaymentSession session = pendingSession();
		session.cancel(Instant.now());
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(session));

		mockMvc.perform(post("/api/payment/pid-1/confirm").queryParam("sig", paymentService.sign(session)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("PAYMENT_CANCELLED"));
	}

	@Test
	void cancelKillsThePendingOrderAndRestoresStock() throws Exception {
		PaymentSession session = pendingSession();
		Order order = pendingOrder();
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(session));
		when(orderRepository.lockById(12L)).thenReturn(Optional.of(order));
		stubOrderViews();
		stubStockRow();

		mockMvc.perform(post("/api/payment/pid-1/cancel").queryParam("sig", paymentService.sign(session)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.orderId").value(12))
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertEquals(PaymentStatus.CANCELLED, session.getStatus());
		assertEquals(OrderStatus.CANCELLED, order.getStatus());
		assertNotNull(order.getCancelledAt());
		verify(stockLevelRepository).increment(3001L, 2);
	}

	@Test
	void cancelIsIdempotentOnAnAlreadyCancelledPayment() throws Exception {
		PaymentSession session = pendingSession();
		session.cancel(Instant.now());
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(session));

		mockMvc.perform(post("/api/payment/pid-1/cancel").queryParam("sig", paymentService.sign(session)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));
	}

	@Test
	void cancelOnAConfirmedPaymentIsAConflict() throws Exception {
		PaymentSession session = pendingSession();
		session.confirm(Instant.now());
		when(paymentSessionRepository.lockById("pid-1")).thenReturn(Optional.of(session));

		mockMvc.perform(post("/api/payment/pid-1/cancel").queryParam("sig", paymentService.sign(session)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("PAYMENT_CONFIRMED"));
	}

	@Test
	void aTamperedStoredAmountInvalidatesTheSignature() throws Exception {
		PaymentSession original = pendingSession();
		String stolen = paymentService.sign(original);

		// The signature was minted over 390000; the stored row now says
		// 389999, and verification recomputes from the stored values.
		PaymentSession tampered = new PaymentSession("pid-1", 12L, BigDecimal.valueOf(389999));
		when(paymentSessionRepository.findById("pid-1")).thenReturn(Optional.of(tampered));

		mockMvc.perform(get("/api/payment/pid-1").queryParam("sig", stolen))
			.andExpect(status().isUnauthorized());
	}
}
