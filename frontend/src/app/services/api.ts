const PAYMENTS_BASE = '/api/payment';

export const API = {
	auth: {
		login: '/api/auth/login',
		logout: '/api/auth/logout'
	},
	users: {
		create: '/api/user/create',
		resetPassword: '/api/user/resetPassword',
		me: '/api/user/me',
		mePassword: '/api/user/me/password',
		list: '/api/user',
		byId: (id: number) => `/api/user/${id}`
	},
	products: {
		list: '/api/product',
		create: '/api/product/create',
		byId: (id: number) => `/api/product/${id}`
	},
	categories: {
		list: '/api/category',
		create: '/api/category/create',
		byId: (id: number) => `/api/category/${id}`
	},
	types: {
		list: '/api/type',
		create: '/api/type/create',
		byId: (id: number) => `/api/type/${id}`
	},
	branches: {
		list: '/api/branch',
		byId: (id: number) => `/api/branch/${id}`,
		stock: (id: number) => `/api/branch/${id}/stock`
	},
	orders: {
		place: '/api/order',
		mine: '/api/order/me',
		list: '/api/order',
		byId: (id: number) => `/api/order/${id}`,
		cancel: (id: number) => `/api/order/${id}/cancel`,
		status: (id: number) => `/api/order/${id}/status`
	},
	payments: {
		byId: (id: string) => `${PAYMENTS_BASE}/${id}`,
		confirm: (id: string) => `${PAYMENTS_BASE}/${id}/confirm`,
		cancel: (id: string) => `${PAYMENTS_BASE}/${id}/cancel`
	},
	coupons: {
		list: '/api/coupon',
		validate: '/api/coupon/validate',
		byId: (id: number) => `/api/coupon/${id}`
	},
	wishlist: {
		mine: '/api/wishlist/me',
		toggle: (productId: number) => `/api/wishlist/me/${productId}`
	},
	reports: {
		sales: '/api/report/sales'
	}
} as const;

export function isPaymentPath(url: string): boolean {
	return url.startsWith(`${PAYMENTS_BASE}/`);
}
