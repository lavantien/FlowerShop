package com.lavantien.flowershop.api.error;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
	@ExceptionHandler(ApiException.class)
	public ProblemDetail handle(ApiException exception, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", exception.code());
		return problem;
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ProblemDetail handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "request validation failed");
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", "VALIDATION");
		Map<String, String> errors = new LinkedHashMap<>();
		for (FieldError error : exception.getBindingResult().getFieldErrors()) {
			// The contract maps each field to its first failing message.
			errors.putIfAbsent(error.getField(), error.getDefaultMessage());
		}
		problem.setProperty("errors", errors);
		return problem;
	}

	// Defense in depth under the bean validation: a paging or integrity misuse
	// that slips past the clamps must still answer problem+json, never a 500.
	@ExceptionHandler(InvalidDataAccessApiUsageException.class)
	public ProblemDetail handleInvalidUsage(InvalidDataAccessApiUsageException exception, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
			"the request arguments are out of range");
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", "VALIDATION");
		return problem;
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	public ProblemDetail handleIntegrityViolation(DataIntegrityViolationException exception,
		HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
			"the request would violate a data constraint");
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", "VALIDATION");
		return problem;
	}
}
