package com.lavantien.flowershop.api;

// The shared paging clamps: page floors at 0, size defaults to 12 and stays
// between 1 and 48, silently, the same policy the catalog set.
public record PageQuery(int page, int size) {

	public static PageQuery of(Integer page, Integer size) {
		return new PageQuery(page == null ? 0 : Math.max(page, 0),
			size == null ? 12 : Math.min(Math.max(size, 1), 48));
	}
}
