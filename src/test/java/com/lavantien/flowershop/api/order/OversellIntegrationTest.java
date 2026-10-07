package com.lavantien.flowershop.api.order;

import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.error.ConflictException;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.service.OrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The oversell suite: the atomic stock guard runs as real concurrent
// transactions against the CI MySQL, one contended row, exact winner counts,
// never a negative quantity.
@SpringBootTest
class OversellIntegrationTest {
	@Autowired
	private OrderService orderService;
	@Autowired
	private OrderRepository orderRepository;
	@Autowired
	private OrderItemRepository orderItemRepository;
	@Autowired
	private ProductRepository productRepository;
	@Autowired
	private BranchRepository branchRepository;
	@Autowired
	private StockLevelRepository stockLevelRepository;

	// Orders carry a per-run marker as userId so cleanup finds exactly the
	// rows this class created, whatever the shared database already holds.
	private long marker;
	private final List<Long> branches = new ArrayList<>();
	private final List<Long> products = new ArrayList<>();

	@BeforeEach
	void setUp() {
		marker = System.nanoTime();
	}

	@AfterEach
	void cleanUp() {
		Page<Order> orders = orderRepository.findByUserId(marker, PageRequest.of(0, 500));
		for (Order order : orders.getContent()) {
			orderItemRepository.deleteAll(orderItemRepository.findByOrderId(order.getId()));
		}
		orderRepository.deleteAll(orders.getContent());
		for (Long branchId : branches) {
			stockLevelRepository.deleteAll(stockLevelRepository.findByBranchId(branchId));
		}
		branchRepository.deleteAllById(branches);
		productRepository.deleteAllById(products);
	}

	private Branch persistBranch() {
		Branch branch = branchRepository.save(new Branch("Oversell Branch " + marker, "01 Test Lane",
			"Quận 1", "Hồ Chí Minh", 10.775, 106.705, true));
		branches.add(branch.getId());
		return branch;
	}

	private Product persistProduct(String name) {
		Product product = productRepository.save(new Product(name, "oversell row",
			"https://cdn.example/oversell.jpg", BigDecimal.valueOf(100000), "IT-T", "IT-OVERSELL"));
		products.add(product.getId());
		return product;
	}

	private void setStock(long branchId, long productId, int quantity) {
		StockLevel row = stockLevelRepository.findByBranchIdAndProductId(branchId, productId)
			.orElseGet(() -> new StockLevel(branchId, productId, 0));
		row.setQuantity(quantity);
		stockLevelRepository.save(row);
	}

	private int stock(long branchId, long productId) {
		return stockLevelRepository.findByBranchIdAndProductId(branchId, productId)
			.map(StockLevel::getQuantity).orElse(0);
	}

	private CheckoutRequest request(long branchId, CheckoutRequest.Item... items) {
		return new CheckoutRequest(List.of(items), "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh",
			branchId, null);
	}

	private record Outcome(CheckoutResponse order, String conflictCode) {
		boolean won() {
			return order != null;
		}
	}

	// Every thread parks on the latch so the whole fan hits the contended row
	// in the same window; the executor's close joins them before asserting.
	private List<Outcome> hammer(int threads, CheckoutRequest request) throws Exception {
		CountDownLatch ready = new CountDownLatch(threads);
		CountDownLatch start = new CountDownLatch(1);
		try (ExecutorService pool = Executors.newFixedThreadPool(threads)) {
			List<Future<Outcome>> futures = new ArrayList<>(threads);
			for (int i = 0; i < threads; i++) {
				futures.add(pool.submit((Callable<Outcome>) () -> {
					ready.countDown();
					start.await();
					try {
						return new Outcome(orderService.checkout(marker, request), null);
					} catch (ConflictException conflict) {
						return new Outcome(null, conflict.code());
					}
				}));
			}
			ready.await();
			start.countDown();
			List<Outcome> outcomes = new ArrayList<>(threads);
			for (Future<Outcome> future : futures) {
				outcomes.add(future.get());
			}
			return outcomes;
		}
	}

	@Test
	void exactlyThreeWinnersWhenTenThreadsHammerAStockOfThree() throws Exception {
		Branch branch = persistBranch();
		Product rose = persistProduct("Oversell Rose " + marker);
		setStock(branch.getId(), rose.getId(), 3);

		List<Outcome> outcomes = hammer(10, request(branch.getId(), new CheckoutRequest.Item(rose.getId(), 1)));

		long winners = outcomes.stream().filter(Outcome::won).count();
		assertEquals(3, winners, "stock of 3 must sell exactly 3 times under 10-way contention");
		for (Outcome outcome : outcomes) {
			if (!outcome.won()) {
				assertEquals("OUT_OF_STOCK", outcome.conflictCode());
			}
		}
		assertEquals(0, stock(branch.getId(), rose.getId()));

		Page<Order> orders = orderRepository.findByUserId(marker, PageRequest.of(0, 10));
		assertEquals(3, orders.getTotalElements());
		int sold = orders.getContent().stream()
			.flatMap(order -> orderItemRepository.findByOrderId(order.getId()).stream())
			.mapToInt(OrderItem::getQuantity).sum();
		assertEquals(3, sold);
	}

	@Test
	void theMultiItemCartStopsShortWhenOneLineRunsDry() throws Exception {
		Branch branch = persistBranch();
		Product rose = persistProduct("Oversell Rose " + marker);
		Product tulip = persistProduct("Oversell Tulip " + marker);
		setStock(branch.getId(), rose.getId(), 3);
		setStock(branch.getId(), tulip.getId(), 1);

		List<Outcome> outcomes = hammer(10, request(branch.getId(),
			new CheckoutRequest.Item(rose.getId(), 1), new CheckoutRequest.Item(tulip.getId(), 1)));

		long winners = outcomes.stream().filter(Outcome::won).count();
		assertEquals(1, winners, "the tulip line caps the whole cart at exactly one winner");
		for (Outcome outcome : outcomes) {
			if (!outcome.won()) {
				assertEquals("OUT_OF_STOCK", outcome.conflictCode());
			}
		}
		// Exactly one rose decrement committed; every rolled-back contender
		// left the row where it was.
		assertEquals(2, stock(branch.getId(), rose.getId()));
		assertEquals(0, stock(branch.getId(), tulip.getId()));
	}

	@Test
	void aFailedLineRollsBackTheDecrementOfTheEarlierLines() {
		Branch branch = persistBranch();
		Product rose = persistProduct("Oversell Rose " + marker);
		Product tulip = persistProduct("Oversell Tulip " + marker);
		setStock(branch.getId(), rose.getId(), 3);
		setStock(branch.getId(), tulip.getId(), 2);

		ConflictException conflict = assertThrows(ConflictException.class, () -> orderService.checkout(marker,
			request(branch.getId(), new CheckoutRequest.Item(rose.getId(), 1),
				new CheckoutRequest.Item(tulip.getId(), 5))));

		assertEquals("OUT_OF_STOCK", conflict.code());
		assertTrue(conflict.getMessage().contains("Oversell Tulip"), "the detail must name the failing item");
		assertEquals(3, stock(branch.getId(), rose.getId()), "the rose decrement must roll back with the cart");
		assertTrue(orderRepository.findByUserId(marker, PageRequest.of(0, 10)).getContent().isEmpty(),
			"no order row may survive the failed checkout");
	}
}
