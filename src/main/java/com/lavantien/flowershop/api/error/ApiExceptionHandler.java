package com.lavantien.flowershop.api.error;

import com.lavantien.flowershop.api.coupon.Coupon;
import com.lavantien.flowershop.api.user.User;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.TypeMismatchException;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Extending ResponseEntityExceptionHandler claims the framework-raised
// failures (unreadable bodies, type mismatches, method validation, unmatched
// routes, wrong methods) so every error path renders problem+json. The base
// class would already answer those with a bare problem document; each override
// below keeps the contract's code field, and the validation shapes keep the
// per-field errors map.
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
	private static final Map<String, String> CONFLICT_CODES_BY_KEY = Map.of(
		User.EMAIL_UNIQUE_KEY, "EMAIL_IN_USE",
		Coupon.CODE_UNIQUE_KEY, "NAME_IN_USE");

	private static final Pattern DUPLICATE_KEY = Pattern.compile("for key '([^']+)'");

	@ExceptionHandler(ApiException.class)
	public ProblemDetail handle(ApiException exception, HttpServletRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", exception.code());
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

	// A raced unique-key insert answers "Duplicate entry ... for key '<name>'"
	// on MySQL 9; the documented 409 codes map by constraint name while any
	// other integrity failure stays a 400.
	@ExceptionHandler(DataIntegrityViolationException.class)
	public ProblemDetail handleIntegrityViolation(DataIntegrityViolationException exception,
		HttpServletRequest request) {
		String key = duplicateKeyOf(exception);
		String conflictCode = key == null ? null : CONFLICT_CODES_BY_KEY.get(key);
		ProblemDetail problem = conflictCode == null
			? ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "the request would violate a data constraint")
			: ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
				"the request collides with an existing row on a unique key");
		problem.setInstance(URI.create(request.getRequestURI()));
		problem.setProperty("code", conflictCode == null ? "VALIDATION" : conflictCode);
		return problem;
	}

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException exception,
		HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = validationProblem(request);
		Map<String, String> errors = new LinkedHashMap<>();
		for (FieldError error : exception.getBindingResult().getFieldErrors()) {
			// The contract maps each field to its first failing message.
			errors.putIfAbsent(error.getField(), error.getDefaultMessage());
		}
		problem.setProperty("errors", errors);
		return response(problem, headers, status);
	}

	// The bulk endpoints take List<@Valid element> bodies, which Spring method
	// validation rejects with this type; element violations carry the list
	// index so the field key stays unambiguous across the batch.
	@Override
	protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException exception,
		HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = validationProblem(request);
		Map<String, String> errors = new LinkedHashMap<>();
		for (ParameterValidationResult result : exception.getParameterValidationResults()) {
			Integer index = result.getContainerIndex();
			for (MessageSourceResolvable error : result.getResolvableErrors()) {
				String field = error instanceof FieldError fieldError ? fieldError.getField() : "value";
				errors.putIfAbsent(index == null ? field : index + "." + field, error.getDefaultMessage());
			}
		}
		problem.setProperty("errors", errors);
		return response(problem, headers, status);
	}

	@Override
	protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException exception, HttpHeaders headers,
		HttpStatusCode status, WebRequest request) {
		String name = exception instanceof MethodArgumentTypeMismatchException mismatch ? mismatch.getName() : "value";
		ProblemDetail problem = validationProblem(request, "the parameter " + name + " has the wrong type");
		return response(problem, headers, status);
	}

	@Override
	protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException exception,
		HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = validationProblem(request, "the request body is not readable JSON for this endpoint");
		return response(problem, headers, status);
	}

	@Override
	protected ResponseEntity<Object> handleHttpRequestMethodNotSupported(HttpRequestMethodNotSupportedException exception,
		HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.METHOD_NOT_ALLOWED,
			"the request method is not supported on this endpoint");
		problem.setInstance(uriOf(request));
		problem.setProperty("code", "METHOD_NOT_ALLOWED");
		return response(problem, headers, status);
	}

	// Unmatched /api routes fall through the SPA forward to the static
	// handler, whose NoResourceFoundException lands here.
	@Override
	protected ResponseEntity<Object> handleNoResourceFoundException(NoResourceFoundException exception,
		HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "no such endpoint");
		problem.setInstance(uriOf(request));
		problem.setProperty("code", "NOT_FOUND");
		return response(problem, headers, status);
	}

	private static ProblemDetail validationProblem(WebRequest request) {
		return validationProblem(request, "request validation failed");
	}

	private static ProblemDetail validationProblem(WebRequest request, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
		problem.setInstance(uriOf(request));
		problem.setProperty("code", "VALIDATION");
		return problem;
	}

	private static ResponseEntity<Object> response(ProblemDetail problem, HttpHeaders headers, HttpStatusCode status) {
		return ResponseEntity.status(status).headers(headers).body(problem);
	}

	private static URI uriOf(WebRequest request) {
		return request instanceof ServletWebRequest servlet ? URI.create(servlet.getRequest().getRequestURI()) : null;
	}

	// Walks the cause chain for MySQL's duplicate-entry message and returns
	// the violated constraint's name, tolerating the 'table.constraint'
	// qualified form. Null when the violation is not a duplicate key.
	private static String duplicateKeyOf(DataIntegrityViolationException exception) {
		for (Throwable cause = exception; cause != null && cause != cause.getCause(); cause = cause.getCause()) {
			if (cause.getMessage() == null || !cause.getMessage().contains("Duplicate entry")) {
				continue;
			}
			Matcher match = DUPLICATE_KEY.matcher(cause.getMessage());
			if (match.find()) {
				String key = match.group(1);
				return key.substring(key.lastIndexOf('.') + 1);
			}
		}
		return null;
	}
}
