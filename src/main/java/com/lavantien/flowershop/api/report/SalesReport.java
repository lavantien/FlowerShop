package com.lavantien.flowershop.api.report;

import com.lavantien.flowershop.api.order.OrderStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record SalesReport(Totals totals, Map<OrderStatus, BigDecimal> revenueByStatus,
	Map<OrderStatus, Long> countsByStatus, List<DayRevenue> revenueByDay, List<TopProduct> topProducts) {

	public record Totals(BigDecimal revenue, long orders, BigDecimal avgOrder) {}

	public record DayRevenue(String day, BigDecimal revenue) {}

	public record TopProduct(Long productId, String name, long quantity, BigDecimal revenue) {}
}
