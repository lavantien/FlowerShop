package com.lavantien.flowershop.api.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderView(Long id, Long userId, OrderStatus status, Instant placedAt, Instant paidAt,
	Instant shippedAt, Instant completedAt, Instant cancelledAt, String phone, String address, String district,
	String city, Long branchId, String branchName, Double distanceKm, BigDecimal deliveryFee, String couponCode,
	BigDecimal discountAmount, BigDecimal subtotal, BigDecimal total, List<OrderItemView> items) {

	public record OrderItemView(Long id, Long productId, String productName, BigDecimal unitPrice, int quantity,
		BigDecimal lineTotal) {

		static OrderItemView of(OrderItem item) {
			return new OrderItemView(item.getId(), item.getProductId(), item.getProductName(), item.getUnitPrice(),
				item.getQuantity(), item.getLineTotal());
		}
	}

	public static OrderView of(Order order, List<OrderItem> items, String branchName) {
		return new OrderView(order.getId(), order.getUserId(), order.getStatus(), order.getPlacedAt(),
			order.getPaidAt(), order.getShippedAt(), order.getCompletedAt(), order.getCancelledAt(),
			order.getPhone(), order.getAddress(), order.getDistrict(), order.getCity(), order.getBranchId(),
			branchName, order.getDistanceKm(), order.getDeliveryFee(), order.getCouponCode(),
			order.getDiscountAmount(), order.getSubtotal(), order.getTotal(),
			items.stream().map(OrderItemView::of).toList());
	}
}
