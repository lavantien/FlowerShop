package com.lavantien.flowershop.api.order;

import com.lavantien.flowershop.SeededGenerator;
import com.lavantien.flowershop.api.branch.Branch;
import com.lavantien.flowershop.api.branch.BranchRepository;
import com.lavantien.flowershop.api.branch.StockLevel;
import com.lavantien.flowershop.api.branch.StockLevelRepository;
import com.lavantien.flowershop.api.coupon.Coupon;
import com.lavantien.flowershop.api.coupon.CouponKind;
import com.lavantien.flowershop.api.coupon.CouponRepository;
import com.lavantien.flowershop.api.payment.PaymentSession;
import com.lavantien.flowershop.api.payment.PaymentSessionRepository;
import com.lavantien.flowershop.api.product.Product;
import com.lavantien.flowershop.api.product.ProductRepository;
import com.lavantien.flowershop.service.CouponService;
import com.lavantien.flowershop.service.GeoService;
import com.lavantien.flowershop.service.OrderService;
import com.lavantien.flowershop.service.PaymentService;
import com.lavantien.flowershop.service.ShopProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Property view of the checkout money pipeline: OrderService.checkout drives
// the real GeoService fee, the real coupon formula, and the real rounding, so
// every amount it writes on the order, its lines, and the payment session is
// whole dong, non-negative, and consistent with an independent long-arithmetic
// oracle. The JSON pass proves the wire shape: serialized money never carries
// a decimal point.
class CheckoutMoneyPropertyTest {
	private static final long SEED = 20261011L;
	private static final int CHECKOUTS = 250;
	private static final String[] DISTRICTS = {"Bình Thạnh", "Cầu Giấy", "Hải Châu", "Ninh Kiều", "Vũng Tàu"};
	private static final String[] CITIES = {"Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Cần Thơ", "Bà Rịa - Vũng Tàu"};
	private static final ShopProperties PROPERTIES = new ShopProperties(
		new ShopProperties.Delivery(20000, 5000, 200000, 1000),
		new ShopProperties.Payment("dev-only-secret", "/pay"));
	private static final String[] MONEY_FIELDS = {"deliveryFee", "discountAmount", "subtotal", "total",
		"unitPrice", "lineTotal"};

	private final SeededGenerator gen = new SeededGenerator(SEED);
	private final ObjectMapper mapper = new ObjectMapper();
	// The save answers record every persisted row so each iteration judges its
	// own order and session without Mockito call-count bookkeeping.
	private final List<Order> savedOrders = new ArrayList<>();
	private final List<PaymentSession> savedSessions = new ArrayList<>();

	private ProductRepository productRepository;
	private BranchRepository branchRepository;
	private CouponRepository couponRepository;
	private OrderService orderService;

	@BeforeEach
	void setUp() {
		OrderRepository orderRepository = mock(OrderRepository.class);
		OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
		productRepository = mock(ProductRepository.class);
		branchRepository = mock(BranchRepository.class);
		StockLevelRepository stockLevelRepository = mock(StockLevelRepository.class);
		PaymentSessionRepository paymentSessionRepository = mock(PaymentSessionRepository.class);
		couponRepository = mock(CouponRepository.class);
		when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
			Order order = invocation.getArgument(0);
			order.setId(777L);
			savedOrders.add(order);
			return order;
		});
		when(orderItemRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
		when(paymentSessionRepository.save(any(PaymentSession.class)))
			.thenAnswer(invocation -> {
				PaymentSession session = invocation.getArgument(0);
				savedSessions.add(session);
				return session;
			});
		when(stockLevelRepository.findByBranchIdAndProductId(anyLong(), anyLong()))
			.thenAnswer(invocation -> {
				StockLevel row = new StockLevel(invocation.getArgument(0), invocation.getArgument(1), 25);
				row.setId(9L);
				return Optional.of(row);
			});
		when(stockLevelRepository.decrementIfAvailable(anyLong(), anyInt())).thenReturn(1);
		orderService = new OrderService(orderRepository, orderItemRepository, productRepository, branchRepository,
			stockLevelRepository, paymentSessionRepository, new PaymentService(PROPERTIES),
			new GeoService(PROPERTIES), new CouponService(couponRepository), PROPERTIES);
	}

	// HALF_UP onto the 1000 dong step in plain long arithmetic.
	private static long toStep(long amount) {
		return (amount + 500) / 1000 * 1000;
	}

	private static void assertScaleZero(BigDecimal amount, String what) {
		assertEquals(0, amount.scale(), what + " must serialize as whole dong, got " + amount);
		assertEquals(0, amount.compareTo(amount.stripTrailingZeros()), what + " hides trailing zeros: " + amount);
	}

	@Test
	void everyCheckoutAmountIsWholeDongAndMatchesTheLongOracle() {
		for (int i = 0; i < CHECKOUTS; i++) {
			int lineCount = gen.intBetween(1, 5);
			List<Product> products = new ArrayList<>(lineCount);
			List<CheckoutRequest.Item> items = new ArrayList<>(lineCount);
			long subtotal = 0;
			for (int line = 0; line < lineCount; line++) {
				// Prices mix whole steps with arbitrary dong so rounding paths
				// only sub-step subtotals can reach stay exercised.
				long price = gen.flag() ? gen.longBetween(1, 2000) * 1000 : gen.longBetween(1000, 2_000_000);
				int quantity = gen.intBetween(1, 30);
				Product product = new Product("Product " + line, "demo", "https://cdn.example/x.jpg",
					BigDecimal.valueOf(price), "T", "C");
				product.setId(line + 1L);
				products.add(product);
				items.add(new CheckoutRequest.Item(line + 1L, quantity));
				subtotal += price * quantity;
			}
			when(productRepository.findAllById(any())).thenReturn(products);
			double[] coords = gen.coordinate();
			Branch branch = new Branch("Property Branch", "01 Demo Street", "1", "Hồ Chí Minh",
				coords[0], coords[1], true);
			branch.setId(5L);
			when(branchRepository.findAll()).thenReturn(List.of(branch));

			// Half the carts ride a coupon: an integral percent rate up to 100
			// or a fixed whole-dong amount, exactly what CouponInput stores.
			long percent = gen.longBetween(1, 100);
			long fixed = gen.longBetween(1, 200_000);
			Coupon coupon = gen.flag()
				? new Coupon("PROP", CouponKind.PERCENT, BigDecimal.valueOf(percent), true, null)
				: new Coupon("PROP", CouponKind.FIXED, BigDecimal.valueOf(fixed), true, null);
			when(couponRepository.findByCode("PROP")).thenReturn(Optional.of(coupon));
			String couponCode = gen.flag() ? "PROP" : null;

			String district = DISTRICTS[gen.intBetween(0, DISTRICTS.length - 1)];
			String city = CITIES[gen.intBetween(0, CITIES.length - 1)];
			CheckoutResponse response = orderService.checkout(7L, new CheckoutRequest(items, "0900000001",
				gen.string(40), district, city, null, couponCode));

			Order order = savedOrders.getLast();
			long fee = order.getDeliveryFee().longValueExact();
			long discount = order.getDiscountAmount().longValueExact();
			long expectedDiscount = couponCode == null ? 0
				: coupon.getKind() == CouponKind.PERCENT
					? toStep(Math.min((subtotal * percent + 99) / 100, subtotal))
					: toStep(Math.min(fixed, subtotal));

			assertTrue(fee >= 20000 && fee <= 200000, "fee " + fee + " left the canonical band");
			assertEquals(0, fee % 1000, "fee " + fee + " is not a whole step");
			assertEquals(expectedDiscount, discount, "discount drift at subtotal " + subtotal);
			// discountOn clamps at the subtotal before the step rounding, which
			// may then overshoot it by at most half a step.
			assertTrue(discount >= 0 && discount <= subtotal + 500,
				"discount " + discount + " broke its bounds against subtotal " + subtotal);
			assertEquals(subtotal - discount + fee, order.getTotal().longValueExact(),
				"total is not subtotal minus discount plus fee");
			assertTrue(order.getTotal().signum() >= 0, "total went negative");

			assertScaleZero(order.getSubtotal(), "subtotal");
			assertScaleZero(order.getDeliveryFee(), "delivery fee");
			assertScaleZero(order.getDiscountAmount(), "discount");
			assertScaleZero(order.getTotal(), "total");
			assertEquals(0, order.getSubtotal().compareTo(BigDecimal.valueOf(subtotal)));

			PaymentSession session = savedSessions.getLast();
			assertScaleZero(session.getAmount(), "payment amount");
			assertEquals(0, session.getAmount().compareTo(order.getTotal()));

			OrderView view = response.order();
			assertEquals(items.size(), view.items().size());
			for (int line = 0; line < items.size(); line++) {
				CheckoutRequest.Item item = items.get(line);
				OrderView.OrderItemView lineView = view.items().get(line);
				Product product = products.get(line);
				assertScaleZero(lineView.unitPrice(), "unit price");
				assertScaleZero(lineView.lineTotal(), "line total");
				assertEquals(0, lineView.unitPrice().compareTo(product.getPrice()));
				assertEquals(0, lineView.lineTotal().compareTo(
					product.getPrice().multiply(BigDecimal.valueOf(item.quantity()))));
			}

			// The wire: serialized money fields must be bare integers.
			String json = mapper.writeValueAsString(view);
			for (String field : MONEY_FIELDS) {
				assertTrue(Pattern.compile("\"" + field + "\":-?\\d+[,}]").matcher(json).find(),
					"serialized " + field + " is missing or not an integer in " + json);
				assertFalse(Pattern.compile("\"" + field + "\":-?\\d+\\.").matcher(json).find(),
					"serialized " + field + " carries a decimal point in " + json);
			}
		}
	}
}
