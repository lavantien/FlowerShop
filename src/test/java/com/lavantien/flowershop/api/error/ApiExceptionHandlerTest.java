package com.lavantien.flowershop.api.error;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApiExceptionHandlerTest {
	record SampleBody(String email, String password) {}

	@SuppressWarnings("unused")
	void handler(SampleBody body) {}

	private static HttpServletRequest requestOn(String uri) {
		HttpServletRequest request = mock(HttpServletRequest.class);
		when(request.getRequestURI()).thenReturn(uri);
		return request;
	}

	@Test
	void apiExceptionsRenderStatusCodeDetailAndInstance() {
		ProblemDetail problem = new ApiExceptionHandler()
			.handle(new NotFoundException("no product with id 99"), requestOn("/api/product/99"));

		assertEquals(404, problem.getStatus());
		assertEquals("Not Found", problem.getTitle());
		assertEquals("no product with id 99", problem.getDetail());
		assertEquals("NOT_FOUND", problem.getProperties().get("code"));
		assertEquals("/api/product/99", problem.getInstance().toString());
	}

	@Test
	void conflictExceptionsCarryTheirBusinessCode() {
		ProblemDetail problem = new ApiExceptionHandler()
			.handle(new ConflictException("EMAIL_IN_USE", "that email is already registered"), requestOn("/api/user/create"));

		assertEquals(409, problem.getStatus());
		assertEquals("Conflict", problem.getTitle());
		assertEquals("EMAIL_IN_USE", problem.getProperties().get("code"));
	}

	@Test
	void validationRendersTheFirstMessagePerField() throws Exception {
		Method method = getClass().getDeclaredMethod("handler", SampleBody.class);
		BeanPropertyBindingResult binding = new BeanPropertyBindingResult(new SampleBody(null, null), "request");
		binding.addError(new FieldError("request", "email", "must not be blank"));
		binding.addError(new FieldError("request", "email", "the second message for the same field loses"));
		binding.addError(new FieldError("request", "password", "must not be blank"));

		ProblemDetail problem = new ApiExceptionHandler()
			.handleValidation(new MethodArgumentNotValidException(new MethodParameter(method, 0), binding),
				requestOn("/api/example"));

		assertEquals(400, problem.getStatus());
		assertEquals("Bad Request", problem.getTitle());
		assertEquals("VALIDATION", problem.getProperties().get("code"));
		assertEquals(Map.of("email", "must not be blank", "password", "must not be blank"),
			problem.getProperties().get("errors"));
	}
}
