package com.lavantien.flowershop.api;

// The shared paging clamps: page floors at 0, size defaults to 12 and stays
// between 1 and 48, silently, the same policy the catalog set.
public record PageQuery(int page, int size) {

	public static PageQuery of(Integer page, Integer size) {
		int clampedSize = size == null ? 12 : Math.min(Math.max(size, 1), 48);
		return new PageQuery(clampPage(page, clampedSize), clampedSize);
	}

	// Spring Data answers a pageable whose offset leaves int range with a 500,
	// so the page clamps down until page*size + size fits; a page past the
	// data is an ordinary empty page either way.
	private static int clampPage(Integer page, int clampedSize) {
		int maxPage = (int) ((Integer.MAX_VALUE - (long) clampedSize) / clampedSize);
		return Math.min(page == null ? 0 : Math.max(page, 0), maxPage);
	}
}
