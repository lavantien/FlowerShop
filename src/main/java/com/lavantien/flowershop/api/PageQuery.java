package com.lavantien.flowershop.api;

public record PageQuery(int page, int size) {

	public static PageQuery of(Integer page, Integer size) {
		int clampedSize = size == null ? 12 : Math.min(Math.max(size, 1), 48);
		return new PageQuery(clampPage(page, clampedSize), clampedSize);
	}

	private static int clampPage(Integer page, int clampedSize) {
		int maxPage = (int) ((Integer.MAX_VALUE - (long) clampedSize) / clampedSize);
		return Math.min(page == null ? 0 : Math.max(page, 0), maxPage);
	}
}
