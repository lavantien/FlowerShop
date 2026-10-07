package com.lavantien.flowershop.api.order;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The standalone suite pins controller shapes with mocked repositories; this
// class runs the admin filter specification and the newest-first ordering as
// real SQL against the CI MySQL.
@SpringBootTest
@Transactional
class OrderListingIntegrationTest {
	@Autowired
	private OrderRepository orderRepository;

	private Order persist(OrderStatus status, String placedAt) {
		Order order = new Order(4L, "0900000001", "01 Demo Lane", "Quận 1", "Hồ Chí Minh", 1L, 4.2,
			BigDecimal.valueOf(40000), null, BigDecimal.ZERO, BigDecimal.valueOf(350000),
			BigDecimal.valueOf(390000));
		order.setStatus(status);
		order.setPlacedAt(Instant.parse(placedAt));
		return orderRepository.save(order);
	}

	private static List<Long> ids(Page<Order> page) {
		return page.getContent().stream().map(Order::getId).toList();
	}

	private Page<Order> run(OrderStatus status, Instant from, Instant to) {
		return orderRepository.findAll(OrderController.adminSpecification(status, from, to),
			PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "id")));
	}

	@Test
	void filtersComposeAcrossStatusAndTheFromToWindow() {
		Order september = persist(OrderStatus.PENDING, "2026-09-30T04:00:00Z");
		Order earlyPaid = persist(OrderStatus.PAID, "2026-10-03T04:00:00Z");
		Order latePaid = persist(OrderStatus.PAID, "2026-10-05T04:00:00Z");
		Order completed = persist(OrderStatus.COMPLETED, "2026-10-07T04:00:00Z");

		assertEquals(List.of(latePaid.getId(), earlyPaid.getId()), ids(run(OrderStatus.PAID, null, null)));
		assertEquals(List.of(latePaid.getId()),
			ids(run(OrderStatus.PAID, OrderController.parseInstant("2026-10-04", false), null)));
		assertEquals(List.of(earlyPaid.getId()),
			ids(run(OrderStatus.PAID, null, OrderController.parseInstant("2026-10-04", true))));
		assertEquals(List.of(earlyPaid.getId()),
			ids(run(OrderStatus.PAID, OrderController.parseInstant("2026-10-01", false),
				OrderController.parseInstant("2026-10-04", true))));

		List<Long> unfiltered = ids(run(null, null, null));
		assertTrue(unfiltered.containsAll(
			List.of(september.getId(), earlyPaid.getId(), latePaid.getId(), completed.getId())));
		assertTrue(unfiltered.indexOf(completed.getId()) < unfiltered.indexOf(latePaid.getId()));
		assertTrue(unfiltered.indexOf(latePaid.getId()) < unfiltered.indexOf(earlyPaid.getId()));
		assertTrue(unfiltered.indexOf(earlyPaid.getId()) < unfiltered.indexOf(september.getId()));
	}

	@Test
	void aGarbageStatusFilterIsNoFilterAtAll() {
		Order order = persist(OrderStatus.PENDING, "2026-10-01T04:00:00Z");

		List<Long> found = ids(run(OrderController.parseStatus("SHREDDER"), null, null));
		assertTrue(found.contains(order.getId()));
	}
}
