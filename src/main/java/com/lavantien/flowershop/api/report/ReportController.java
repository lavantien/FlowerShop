package com.lavantien.flowershop.api.report;

import com.lavantien.flowershop.api.security.RequireRole;
import com.lavantien.flowershop.api.user.Role;
import com.lavantien.flowershop.service.ReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/report")
public class ReportController {
	private final ReportService reportService;

	public ReportController(ReportService reportService) {
		this.reportService = reportService;
	}

	@RequireRole(Role.ADMIN)
	@GetMapping("/sales")
	public SalesReport sales(@RequestParam(required = false) String from,
		@RequestParam(required = false) String to) {
		LocalDate today = LocalDate.now(ZoneOffset.UTC);
		Window window = window(from, to, today);
		return reportService.sales(window.from(), window.to());
	}

	// Absent or garbage dates fall back to the last 30 days ending today, the
	// same silent-clamp policy the catalog and order filters follow.
	static Window window(String from, String to, LocalDate today) {
		LocalDate toDate = parseDate(to, today);
		LocalDate fromDate = parseDate(from, toDate.minusDays(30));
		return new Window(fromDate, toDate);
	}

	public record Window(LocalDate from, LocalDate to) {}

	private static LocalDate parseDate(String raw, LocalDate fallback) {
		if (raw == null || raw.isBlank()) {
			return fallback;
		}
		try {
			return LocalDate.parse(raw.strip());
		} catch (DateTimeParseException ignored) {
			return fallback;
		}
	}
}
