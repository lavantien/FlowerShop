package com.lavantien.flowershop.api.payment;

import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.order.Order;
import com.lavantien.flowershop.api.order.OrderItem;
import com.lavantien.flowershop.api.order.OrderItemRepository;
import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.order.OrderStatus;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.api.user.User;
import com.lavantien.flowershop.api.user.UserRepository;
import com.lavantien.flowershop.service.PasswordService;
import com.lavantien.flowershop.service.PaymentService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class PaymentReplayAndTamperIntegrationTest {
	@Autowired
	private WebApplicationContext context;
	private MockMvc mockMvc;
	@Autowired
	private OrderRepository orderRepository;
	@Autowired
	private OrderItemRepository orderItemRepository;
	@Autowired
	private BranchRepository branchRepository;
	@Autowired
	private StockLevelRepository stockLevelRepository;
	@Autowired
	private ProductRepository productRepository;
	@Autowired
	private PaymentSessionRepository paymentSessionRepository;
	@Autowired
	private UserRepository userRepository;
	@Autowired
	private PasswordService passwordService;
	@Autowired
	private PaymentService paymentService;

	private long marker;
	private final List<Long> orders = new ArrayList<>();
	private final List<Long> branches = new ArrayList<>();
	private final List<Long> products = new ArrayList<>();
	private final List<Long> users = new ArrayList<>();

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
	}

	@AfterEach
	void cleanUp() {
		for (Long orderId : orders) {
			paymentSessionRepository.findByOrderId(orderId)
				.ifPresent(session -> paymentSessionRepository.deleteById(session.getId()));
			orderItemRepository.deleteAll(orderItemRepository.findByOrderId(orderId));
		}
		orderRepository.deleteAllById(orders);
		for (Long branchId : branches) {
			stockLevelRepository.deleteAll(stockLevelRepository.findByBranchId(branchId));
		}
		branchRepository.deleteAllById(branches);
		productRepository.deleteAllById(products);
		userRepository.deleteAllById(users);
	}

	private Order seedPendingOrder(String paymentId) {
		marker = System.nanoTime();
		Branch branch = branchRepository.save(new Branch("Tamper Branch " + marker, "01 Test Lane",
			"Quận 1", "Hồ Chí Minh", 10.775, 106.705, true));
		branches.add(branch.getId());
		Product rose = productRepository.save(new Product("Tamper Rose " + marker, "tamper row",
			"https://cdn.example/tamper.jpg", BigDecimal.valueOf(100000), "IT-T", "IT-TAMPER"));
		products.add(rose.getId());
		StockLevel row = new StockLevel(branch.getId(), rose.getId(), 5);
		stockLevelRepository.save(row);

		Order order = new Order(4L, "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh", branch.getId(),
			4.2, BigDecimal.valueOf(40000), null, BigDecimal.ZERO, BigDecimal.valueOf(200000),
			BigDecimal.valueOf(240000));
		order.setStatus(OrderStatus.PENDING);
		order.setPlacedAt(Instant.now());
		order = orderRepository.save(order);
		orders.add(order.getId());
		orderItemRepository.save(new OrderItem(order.getId(), rose.getId(), rose.getName(), rose.getPrice(),
			2, BigDecimal.valueOf(200000)));

		PaymentSession session = new PaymentSession(paymentId, order.getId(), BigDecimal.valueOf(240000));
		session.start(Instant.now());
		paymentSessionRepository.save(session);
		return order;
	}

	private String sigOf(String paymentId) {
		return paymentService.sign(paymentSessionRepository.findById(paymentId).orElseThrow());
	}

	private int confirm(String paymentId, String sig) throws Exception {
		return mockMvc.perform(post("/api/payment/{id}/confirm", paymentId).queryParam("sig", sig))
			.andReturn().getResponse().getStatus();
	}

	private int cancel(String paymentId, String sig) throws Exception {
		return mockMvc.perform(post("/api/payment/{id}/cancel", paymentId).queryParam("sig", sig))
			.andReturn().getResponse().getStatus();
	}

	@Test
	void twentyParallelConfirmsProduceExactlyOneStateChange() throws Exception {
		Order order = seedPendingOrder("pid-storm");
		String sig = sigOf("pid-storm");

		int threads = 20;
		CountDownLatch ready = new CountDownLatch(threads);
		CountDownLatch start = new CountDownLatch(1);
		List<Integer> statuses;
		try (ExecutorService pool = Executors.newFixedThreadPool(threads)) {
			List<Future<Integer>> futures = new ArrayList<>(threads);
			for (int i = 0; i < threads; i++) {
				futures.add(pool.submit((Callable<Integer>) () -> {
					ready.countDown();
					start.await();
					return confirm("pid-storm", sig);
				}));
			}
			ready.await();
			start.countDown();
			statuses = new ArrayList<>(threads);
			for (Future<Integer> future : futures) {
				statuses.add(future.get());
			}
		}

		assertEquals(20, statuses.stream().filter(code -> code == 200).count());

		PaymentSession session = paymentSessionRepository.findById("pid-storm").orElseThrow();
		assertEquals(PaymentStatus.CONFIRMED, session.getStatus());
		Order paid = orderRepository.findById(order.getId()).orElseThrow();
		assertEquals(OrderStatus.PAID, paid.getStatus());
		assertEquals(session.getConfirmedAt(), paid.getPaidAt());
	}

	@Test
	void theTamperMatrixDiesOnTheSignatureOrTheStateGuard() throws Exception {
		Order forged = seedPendingOrder("pid-forged");
		String sig = sigOf("pid-forged");
		String flipped = (sig.charAt(0) == '0' ? "1" : "0") + sig.substring(1);
		assertEquals(401, confirm("pid-forged", flipped));

		seedPendingOrder("pid-truncated");
		assertEquals(401, confirm("pid-truncated", sigOf("pid-truncated").substring(0, 63)));

		seedPendingOrder("pid-cross-a");
		seedPendingOrder("pid-cross-b");
		assertEquals(401, confirm("pid-cross-a", sigOf("pid-cross-b")));

		Order tampered = seedPendingOrder("pid-amount");
		String stolen = sigOf("pid-amount");
		paymentSessionRepository.deleteById("pid-amount");
		PaymentSession moved = new PaymentSession("pid-amount", tampered.getId(), BigDecimal.valueOf(239999));
		moved.start(Instant.now());
		paymentSessionRepository.save(moved);
		assertEquals(401, confirm("pid-amount", stolen));

		for (String id : new String[]{"pid-forged", "pid-truncated", "pid-cross-a", "pid-amount"}) {
			assertEquals(PaymentStatus.PENDING, paymentSessionRepository.findById(id).orElseThrow().getStatus(),
				id + " must stay PENDING behind a refused signature");
		}
		assertEquals(OrderStatus.PENDING, orderRepository.findById(forged.getId()).orElseThrow().getStatus());

		Order cancelled = seedPendingOrder("pid-cc");
		String ccSig = sigOf("pid-cc");
		assertEquals(200, cancel("pid-cc", ccSig));
		assertEquals(409, confirm("pid-cc", ccSig));
		assertEquals(OrderStatus.CANCELLED, orderRepository.findById(cancelled.getId()).orElseThrow().getStatus());

		Order confirmed = seedPendingOrder("pid-cf");
		String cfSig = sigOf("pid-cf");
		assertEquals(200, confirm("pid-cf", cfSig));
		assertEquals(409, cancel("pid-cf", cfSig));
		assertEquals(OrderStatus.PAID, orderRepository.findById(confirmed.getId()).orElseThrow().getStatus());
	}

	@Test
	void aReplayedConfirmAfterConfirmChangesNothing() throws Exception {
		Order order = seedPendingOrder("pid-replay");
		String sig = sigOf("pid-replay");

		assertEquals(200, confirm("pid-replay", sig));
		Instant confirmedAt = paymentSessionRepository.findById("pid-replay").orElseThrow().getConfirmedAt();
		Instant paidAt = orderRepository.findById(order.getId()).orElseThrow().getPaidAt();

		mockMvc.perform(post("/api/payment/pid-replay/confirm").queryParam("sig", sig))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.orderId").value(order.getId()))
			.andExpect(jsonPath("$.status").value("CONFIRMED"));

		assertEquals(confirmedAt, paymentSessionRepository.findById("pid-replay").orElseThrow().getConfirmedAt());
		assertEquals(paidAt, orderRepository.findById(order.getId()).orElseThrow().getPaidAt());
	}

	@Test
	void orderTimestampsSerializeAsIsoInstantsThroughTheRealPipeline() throws Exception {
		Order order = seedPendingOrder("pid-iso");
		User admin = new User("Tamper Admin", passwordService.hash("1234qwer"),
			"tamper-admin-" + System.nanoTime() + "@flowershop.example", "0900000002", "01 Admin Lane",
			"Quận 1", "Hồ Chí Minh", "demo");
		admin.setRole(Role.ADMIN);
		admin = userRepository.save(admin);
		users.add(admin.getId());
		assertEquals(200, confirm("pid-iso", sigOf("pid-iso")));

		MvcResult login = mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\": \"" + admin.getEmail() + "\", \"password\": \"1234qwer\"}"))
			.andExpect(status().isOk()).andReturn();
		String token = JsonPath.read(login.getResponse().getContentAsString(), "$.token");

		mockMvc.perform(get("/api/order/{id}", order.getId()).header("X-Auth-Token", token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.placedAt").isNotEmpty())
			.andExpect(jsonPath("$.paidAt", matchesPattern(
				"\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}([.,]\\d+)?Z")));
	}
}
