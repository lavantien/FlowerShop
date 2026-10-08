package com.lavantien.flowershop.service;

import com.lavantien.flowershop.api.payment.PaymentSession;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class PaymentService {
	private final ShopProperties.Payment payment;

	public PaymentService(ShopProperties properties) {
		this.payment = properties.payment();
	}

	public String sign(PaymentSession session) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(payment.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			String payload = session.getId() + ":" + session.getOrderId() + ":"
				+ session.getAmount().toPlainString();
			return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
		} catch (GeneralSecurityException broken) {
			throw new IllegalStateException("the hmac signature could not be computed", broken);
		}
	}

	public boolean matches(PaymentSession session, String sig) {
		if (sig == null || sig.isBlank()) {
			return false;
		}
		byte[] expected = sign(session).getBytes(StandardCharsets.UTF_8);
		byte[] provided = sig.strip().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
		return MessageDigest.isEqual(expected, provided);
	}

	public String redirectUrl(PaymentSession session) {
		return payment.baseUrl() + "/" + session.getId() + "?sig=" + sign(session);
	}
}
