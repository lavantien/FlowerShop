package com.lavantien.flowershop.api.order;

import com.lavantien.flowershop.api.payment.PaymentRedirect;

public record CheckoutResponse(OrderView order, PaymentRedirect payment) {}
