package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.order.Order;
import com.lavantien.flowershop.api.order.OrderItem;
import com.lavantien.flowershop.api.order.OrderItemRepository;
import com.lavantien.flowershop.api.order.OrderRepository;
import com.lavantien.flowershop.api.order.OrderStatus;
import com.lavantien.flowershop.api.report.SalesReport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

@Service
public class ReportService {
	// Revenue counts these three statuses only; PENDING and CANCELLED rows
	// still land in countsByStatus but never in any money figure.
	private static final Set<OrderStatus> REVENUE_STATUSES = Set.of(OrderStatus.PAID, OrderStatus.SHIPPED,
		OrderStatus.COMPLETED);
	private static final int TOP_PRODUCTS = 10;

	private final OrderRepository orderRepository;
	private final OrderItemRepository orderItemRepository;
	private final ShopProperties properties;

	public ReportService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
		ShopProperties properties) {
		this.orderRepository = orderRepository;
		this.orderItemRepository = orderItemRepository;
		this.properties = properties;
	}

	@Transactional(readOnly = true)
	public SalesReport sales(LocalDate from, LocalDate to) {
		Instant fromInstant = from.atStartOfDay(ZoneOffset.UTC).toInstant();
		Instant toInstant = to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
		List<Order> orders = orderRepository.findByPlacedAtGreaterThanEqualAndPlacedAtLessThan(fromInstant, toInstant);

		Map<OrderStatus, BigDecimal> revenueByStatus = zeroedRevenue();
		Map<OrderStatus, Long> countsByStatus = zeroedCounts();
		BigDecimal revenue = BigDecimal.ZERO;
		List<Long> revenueOrderIds = new ArrayList<>();
		Map<LocalDate, BigDecimal> revenueByDay = new TreeMap<>();
		for (Order order : orders) {
			countsByStatus.merge(order.getStatus(), 1L, Long::sum);
			if (!REVENUE_STATUSES.contains(order.getStatus())) {
				continue;
			}
			revenueByStatus.put(order.getStatus(), revenueByStatus.get(order.getStatus()).add(order.getTotal()));
			revenue = revenue.add(order.getTotal());
			revenueOrderIds.add(order.getId());
			LocalDate day = order.getPlacedAt().atZone(ZoneOffset.UTC).toLocalDate();
			revenueByDay.merge(day, order.getTotal(), BigDecimal::add);
		}

		long orderCount = revenueOrderIds.size();
		BigDecimal avgOrder = orderCount == 0 ? BigDecimal.ZERO
			: properties.delivery().round(revenue.divide(BigDecimal.valueOf(orderCount), 6, RoundingMode.HALF_UP));
		return new SalesReport(new SalesReport.Totals(revenue, orderCount, avgOrder),
			revenueByStatus, countsByStatus, dayRows(revenueByDay), topProducts(revenueOrderIds));
	}

	private List<SalesReport.DayRevenue> dayRows(Map<LocalDate, BigDecimal> revenueByDay) {
		return revenueByDay.entrySet().stream()
			.map(entry -> new SalesReport.DayRevenue(entry.getKey().toString(), entry.getValue()))
			.toList();
	}

	private List<SalesReport.TopProduct> topProducts(List<Long> revenueOrderIds) {
		if (revenueOrderIds.isEmpty()) {
			return List.of();
		}
		record Aggregate(String name, long quantity, BigDecimal revenue) {}
		Map<Long, Aggregate> byProduct = new LinkedHashMap<>();
		for (OrderItem item : orderItemRepository.findByOrderIdIn(revenueOrderIds)) {
			Aggregate current = byProduct.get(item.getProductId());
			// The name snapshot is stable per product, the first one seen wins.
			Aggregate merged = new Aggregate(current == null ? item.getProductName() : current.name(),
				(current == null ? 0 : current.quantity()) + item.getQuantity(),
				(current == null ? BigDecimal.ZERO : current.revenue()).add(item.getLineTotal()));
			byProduct.put(item.getProductId(), merged);
		}
		List<SalesReport.TopProduct> rows = byProduct.entrySet().stream()
			.map(entry -> new SalesReport.TopProduct(entry.getKey(), entry.getValue().name(),
				entry.getValue().quantity(), entry.getValue().revenue()))
			.toList();
		return rows.stream()
			.sorted(Comparator.comparingLong(SalesReport.TopProduct::quantity).reversed()
				.thenComparing(SalesReport.TopProduct::productId))
			.limit(TOP_PRODUCTS)
			.toList();
	}

	private static Map<OrderStatus, BigDecimal> zeroedRevenue() {
		Map<OrderStatus, BigDecimal> map = new EnumMap<>(OrderStatus.class);
		for (OrderStatus status : OrderStatus.values()) {
			map.put(status, BigDecimal.ZERO);
		}
		return map;
	}

	private static Map<OrderStatus, Long> zeroedCounts() {
		Map<OrderStatus, Long> map = new EnumMap<>(OrderStatus.class);
		for (OrderStatus status : OrderStatus.values()) {
			map.put(status, 0L);
		}
		return map;
	}
}
