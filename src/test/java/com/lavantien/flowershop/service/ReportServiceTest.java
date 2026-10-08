package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.order.Order;
import com.lavantien.flowershop.api.order.OrderItem;
import com.lavantien.flowershop.api.order.OrderItemRepository;
import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.order.OrderStatus;
import com.lavantien.flowershop.api.report.SalesReport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReportServiceTest {
	private static final ShopProperties PROPERTIES = new ShopProperties(
		new ShopProperties.Delivery(20000, 5000, 200000, 1000),
		new ShopProperties.Payment("dev-only-secret", "/pay"));

	private OrderRepository orderRepository;
	private OrderItemRepository orderItemRepository;
	private ReportService reportService;

	@BeforeEach
	void setUp() {
		orderRepository = mock(OrderRepository.class);
		orderItemRepository = mock(OrderItemRepository.class);
		reportService = new ReportService(orderRepository, orderItemRepository, PROPERTIES);
	}

	private static Order order(long id, OrderStatus status, String placedAt, long total) {
		Order order = new Order(4L, "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh", 3L, 4.2,
			BigDecimal.valueOf(40000), null, BigDecimal.ZERO, BigDecimal.valueOf(total - 40000),
			BigDecimal.valueOf(total));
		order.setId(id);
		order.setStatus(status);
		order.setPlacedAt(Instant.parse(placedAt));
		return order;
	}

	private static OrderItem item(long orderId, long productId, String name, long unitPrice, int quantity) {
		return new OrderItem(orderId, productId, name, BigDecimal.valueOf(unitPrice), quantity,
			BigDecimal.valueOf(unitPrice * quantity));
	}

	private void stubOrders(List<Order> orders) {
		when(orderRepository.findByPlacedAtGreaterThanEqualAndPlacedAtLessThan(any(), any()))
			.thenReturn(orders);
	}

	@Test
	void revenueCountsOnlyPaidShippedAndCompleted() {
		stubOrders(List.of(
			order(1, OrderStatus.PAID, "2026-10-01T10:00:00Z", 100000),
			order(2, OrderStatus.SHIPPED, "2026-10-02T10:00:00Z", 200000),
			order(3, OrderStatus.COMPLETED, "2026-10-03T10:00:00Z", 50000),
			order(4, OrderStatus.PENDING, "2026-10-04T10:00:00Z", 75000),
			order(5, OrderStatus.CANCELLED, "2026-10-05T10:00:00Z", 25000)));
		when(orderItemRepository.findByOrderIdIn(anyCollection())).thenReturn(List.of());

		SalesReport report = reportService.sales(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7));

		assertEquals(0, BigDecimal.valueOf(350000).compareTo(report.totals().revenue()));
		assertEquals(3, report.totals().orders(), "only the revenue orders count into the average");
		assertEquals(0, BigDecimal.valueOf(117000).compareTo(report.totals().avgOrder()));
		assertEquals(0, BigDecimal.valueOf(100000).compareTo(report.revenueByStatus().get(OrderStatus.PAID)));
		assertEquals(0, BigDecimal.valueOf(200000).compareTo(report.revenueByStatus().get(OrderStatus.SHIPPED)));
		assertEquals(0, BigDecimal.valueOf(50000).compareTo(report.revenueByStatus().get(OrderStatus.COMPLETED)));
		assertEquals(0, BigDecimal.ZERO.compareTo(report.revenueByStatus().get(OrderStatus.PENDING)));
		assertEquals(0, BigDecimal.ZERO.compareTo(report.revenueByStatus().get(OrderStatus.CANCELLED)));
		assertEquals(Long.valueOf(1), report.countsByStatus().get(OrderStatus.PENDING));
		assertEquals(Long.valueOf(1), report.countsByStatus().get(OrderStatus.CANCELLED));
		assertEquals(Long.valueOf(1), report.countsByStatus().get(OrderStatus.PAID));
	}

	@Test
	void mapsCoverAllFiveStatusesEvenWhenEmpty() {
		stubOrders(List.of());
		when(orderItemRepository.findByOrderIdIn(anyCollection())).thenReturn(List.of());

		SalesReport report = reportService.sales(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7));

		assertEquals(5, report.revenueByStatus().size());
		assertEquals(5, report.countsByStatus().size());
		report.revenueByStatus().values().forEach(value ->
			assertEquals(0, BigDecimal.ZERO.compareTo(value), "every status must start at zero"));
		report.countsByStatus().values().forEach(count -> assertEquals(0L, count));
	}

	@Test
	void revenueByDayGroupsOnUtcDaysAscending() {
		stubOrders(List.of(
			order(1, OrderStatus.PAID, "2026-10-03T02:00:00Z", 70000),
			order(2, OrderStatus.SHIPPED, "2026-10-01T18:00:00Z", 50000),
			order(3, OrderStatus.PAID, "2026-10-01T02:00:00Z", 100000),
			order(4, OrderStatus.PENDING, "2026-10-02T02:00:00Z", 90000)));
		when(orderItemRepository.findByOrderIdIn(anyCollection())).thenReturn(List.of());

		SalesReport report = reportService.sales(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7));

		assertEquals(2, report.revenueByDay().size(), "the pending day must not appear");
		assertEquals("2026-10-01", report.revenueByDay().get(0).day());
		assertEquals(0, BigDecimal.valueOf(150000).compareTo(report.revenueByDay().get(0).revenue()));
		assertEquals("2026-10-03", report.revenueByDay().get(1).day());
		assertEquals(0, BigDecimal.valueOf(70000).compareTo(report.revenueByDay().get(1).revenue()));
	}

	@Test
	void topProductsAggregateAcrossOrdersAndRankByQuantity() {
		stubOrders(List.of(
			order(1, OrderStatus.PAID, "2026-10-01T10:00:00Z", 100000),
			order(2, OrderStatus.SHIPPED, "2026-10-02T10:00:00Z", 100000),
			order(3, OrderStatus.CANCELLED, "2026-10-03T10:00:00Z", 100000)));
		when(orderItemRepository.findByOrderIdIn(anyCollection())).thenAnswer(invocation -> {
			java.util.Collection<Long> ids = invocation.getArgument(0);
			return List.of(
					item(1, 10, "Rose", 50000, 1),
					item(1, 20, "Tulip", 25000, 2),
					item(2, 10, "Rose", 50000, 3),
					item(2, 30, "Orchid", 100000, 1),
					item(3, 40, "Ghost", 100000, 9))
				.stream().filter(row -> ids.contains(row.getOrderId())).toList();
		});

		SalesReport report = reportService.sales(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7));

		assertEquals(3, report.topProducts().size());
		assertEquals(10L, report.topProducts().get(0).productId());
		assertEquals("Rose", report.topProducts().get(0).name());
		assertEquals(4, report.topProducts().get(0).quantity(), "quantities aggregate across orders");
		assertEquals(0, BigDecimal.valueOf(200000).compareTo(report.topProducts().get(0).revenue()));
		assertEquals(20L, report.topProducts().get(1).productId());
		assertEquals(2, report.topProducts().get(1).quantity());
		assertEquals(30L, report.topProducts().get(2).productId());
		assertEquals(0, BigDecimal.valueOf(100000).compareTo(report.topProducts().get(2).revenue()));
	}

	@Test
	void topProductsCapAtTenRanks() {
		stubOrders(List.of(order(1, OrderStatus.PAID, "2026-10-01T10:00:00Z", 100000)));
		when(orderItemRepository.findByOrderIdIn(anyCollection())).thenReturn(
			java.util.stream.LongStream.rangeClosed(1, 12)
				.mapToObj(id -> item(1, id, "P" + id, 1000, (int) id))
				.toList());

		SalesReport report = reportService.sales(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7));

		assertEquals(10, report.topProducts().size());
		assertEquals(12, report.topProducts().get(0).quantity(), "the highest quantity ranks first");
		assertEquals(3, report.topProducts().get(9).quantity(), "the cut keeps the top ten only");
	}

	@Test
	void theWindowIsUtcDayAligned() {
		stubOrders(List.of());
		when(orderItemRepository.findByOrderIdIn(anyCollection())).thenReturn(List.of());

		reportService.sales(LocalDate.of(2026, 9, 7), LocalDate.of(2026, 10, 7));

		ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
		ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
		verify(orderRepository).findByPlacedAtGreaterThanEqualAndPlacedAtLessThan(from.capture(), to.capture());
		assertEquals(Instant.parse("2026-09-07T00:00:00Z"), from.getValue());
		assertEquals(Instant.parse("2026-10-08T00:00:00Z"), to.getValue(),
			"the to day stays inside the window through an exclusive end");
	}
}
