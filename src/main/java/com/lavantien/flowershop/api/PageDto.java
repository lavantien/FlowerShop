package com.lavantien.flowershop.api;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record PageDto<T>(List<T> content, long totalElements, int totalPages, int page, int size) {

	public static <T, R> PageDto<R> from(Page<T> page, Function<T, R> view) {
		return new PageDto<>(page.getContent().stream().map(view).toList(), page.getTotalElements(),
			page.getTotalPages(), page.getNumber(), page.getSize());
	}
}
