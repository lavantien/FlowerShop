package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.payment.PaymentSession;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentServiceTest {
	private static final ShopProperties PROPERTIES = new ShopProperties(
		new ShopProperties.Delivery(20000, 5000, 200000, 1000),
		new ShopProperties.Payment("dev-only-secret", "/pay"));

	private final PaymentService paymentService = new PaymentService(PROPERTIES);

	private static PaymentSession session(String id, long orderId, long amount) {
		return new PaymentSession(id, orderId, BigDecimal.valueOf(amount));
	}

	@Test
	void theSignatureIsLowercaseHexHmacOverTheContractPayload() {
		// Vectors computed independently with: openssl dgst -sha256 -hmac.
		assertEquals("7bb676c8049576a4fcea1f1f4aaba9759ce57b9aadb5dc51bfcbc9780d912504",
			paymentService.sign(session("pay-demo-id", 12, 265000)));
		assertEquals("b9cf346afc649beb3cbc9fc388cecfff91e3cb9c497050c18f20b5250e10939f",
			paymentService.sign(session("00000000-0000-0000-0000-000000000abc", 77, 390000)));
	}

	@Test
	void verificationAcceptsTheSignatureAndRefusesEverythingElse() {
		PaymentSession session = session("pay-demo-id", 12, 265000);
		String sig = paymentService.sign(session);
		String forged = (sig.charAt(0) == '0' ? "1" : "0") + sig.substring(1);

		assertTrue(paymentService.matches(session, sig));
		assertFalse(paymentService.matches(session, forged));
		assertFalse(paymentService.matches(session, sig.substring(0, sig.length() - 1)));
		assertFalse(paymentService.matches(session, null));
		assertFalse(paymentService.matches(session, ""));

		// A valid signature from another session never verifies here.
		assertFalse(paymentService.matches(session, paymentService.sign(session("other-id", 12, 265000))));

		// The recomputation binds the amount: a moved decimal kills the sig.
		assertFalse(paymentService.matches(session("pay-demo-id", 12, 265001), sig));
		assertFalse(paymentService.matches(session("pay-demo-id", 13, 265000), sig));
	}

	@Test
	void theRedirectUrlCarriesTheBaseAndTheSignature() {
		PaymentSession session = session("pay-demo-id", 12, 265000);
		assertEquals("/pay/pay-demo-id?sig=" + paymentService.sign(session),
			paymentService.redirectUrl(session));
	}
}
