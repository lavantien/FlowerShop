package com.lavantien.flowershop.api.payment;

public record PaymentOutcome(Long orderId, PaymentStatus status) {}
