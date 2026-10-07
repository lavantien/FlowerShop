package com.lavantien.flowershop.api;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PageQueryTest {

	@Test
	void clampsPageAndSizeSilently() {
		var query = PageQuery.of(null, null);
		assertEquals(0, query.page());
		assertEquals(12, query.size());

		assertEquals(0, PageQuery.of(-5, -3).page());
		assertEquals(1, PageQuery.of(0, 0).size());
		assertEquals(48, PageQuery.of(9, 500).size());
		assertEquals(48, PageQuery.of(9, 48).size());
		assertEquals(1, PageQuery.of(9, 1).size());
		assertEquals(7, PageQuery.of(7, 20).page());
	}

	@Test
	void anOverflowingPageClampsIntoIntOffsetRange() {
		var query = PageQuery.of(2147483647, 48);
		assertEquals(44739241, query.page());
		assertEquals(48, query.size());

		for (int size : new int[] {1, 12, 48}) {
			var clamped = PageQuery.of(Integer.MAX_VALUE, size);
			assertTrue((long) clamped.page() * clamped.size() + clamped.size() <= Integer.MAX_VALUE,
				"page*size + size must stay inside int offset math for size " + size);
		}
		assertEquals(0, PageQuery.of(-2147483647, 12).page(), "a negative page still floors at zero");
	}
}
