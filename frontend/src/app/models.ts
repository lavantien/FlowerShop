
export type Role = 'USER' | 'ADMIN';
export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type CouponKind = 'PERCENT' | 'FIXED';
export type ProductSort = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

export interface User {
	id: number;
	name: string;
	email: string;
	phone: string;
	address: string;
	district: string;
	city: string;
	role: Role;
	enable: boolean;
}

export interface LoginResponse {
	token: string;
	user: User;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	name: string;
	email: string;
	password: string;
	phone: string;
	address: string;
	district: string;
	city: string;
	answer: string;
}

export interface ResetPasswordRequest {
	email: string;
	answer: string;
	newPassword: string;
}

export interface ProfileUpdateRequest {
	name: string;
	phone: string;
	address: string;
	district: string;
	city: string;
}

export interface PasswordChangeRequest {
	currentPassword: string;
	newPassword: string;
}

export interface AdminUserUpdateRequest {
	name: string;
	phone: string;
	role: Role;
	enable: boolean;
}

export interface ProductView {
	id: number;
	name: string;
	description: string;
	imgUrl: string;
	price: number;
	typeName: string;
	categoryName: string;
	stock: number;
}

export interface ProductInput {
	id?: number;
	name: string;
	description: string;
	imgUrl: string;
	price: number;
	typeName: string;
	categoryName: string;
}

export interface Page<T> {
	content: T[];
	totalElements: number;
	totalPages: number;
	page: number;
	size: number;
}

export interface CatalogQuery {
	search?: string;
	category?: string;
	type?: string;
	sort?: ProductSort;
	page?: number;
	size?: number;
}

export interface Category {
	id: number;
	name: string;
}

export interface CategoryInput {
	name: string;
}

export interface Type {
	id: number;
	name: string;
	categoryName: string;
}

export interface TypeInput {
	name: string;
	categoryName: string;
}

export interface Branch {
	id: number;
	name: string;
	address: string;
	district: string;
	city: string;
	lat: number;
	lng: number;
	active: boolean;
}

export interface BranchInput {
	name: string;
	address: string;
	district: string;
	city: string;
	lat: number;
	lng: number;
	active: boolean;
}

export interface StockRow {
	productId: number;
	quantity: number;
}

export interface StockSetRequest {
	productId: number;
	quantity: number;
}

export interface OrderItem {
	id: number;
	productId: number;
	productName: string;
	unitPrice: number;
	quantity: number;
	lineTotal: number;
}

export interface Order {
	id: number;
	userId: number;
	status: OrderStatus;
	placedAt: string;
	paidAt: string | null;
	shippedAt: string | null;
	completedAt: string | null;
	cancelledAt: string | null;
	phone: string;
	address: string;
	district: string;
	city: string;
	branchId: number;
	branchName: string;
	distanceKm: number;
	deliveryFee: number;
	couponCode: string | null;
	discountAmount: number;
	subtotal: number;
	total: number;
	items: OrderItem[];
}

export interface CheckoutItem {
	productId: number;
	quantity: number;
}

export interface CheckoutRequest {
	items: CheckoutItem[];
	phone: string;
	address: string;
	district: string;
	city: string;
	branchId?: number;
	couponCode?: string;
}

export interface PaymentSessionView {
	id: string;
	redirectUrl: string;
}

export interface CheckoutResponse {
	order: Order;
	payment: PaymentSessionView;
}

export interface AdminOrderQuery {
	status?: OrderStatus;
	from?: string;
	to?: string;
	page?: number;
	size?: number;
}

export interface OrderStatusChangeRequest {
	status: OrderStatus;
}

export interface PaymentView {
	paymentId: string;
	orderId: number;
	amount: number;
	status: PaymentStatus;
	summary: string;
}

export interface PaymentActionResult {
	orderId: number;
	status: PaymentStatus;
}

export interface Coupon {
	id: number;
	code: string;
	kind: CouponKind;
	value: number;
	active: boolean;
	expiresAt: string | null;
}

export interface CouponInput {
	code: string;
	kind: CouponKind;
	value: number;
	active: boolean;
	expiresAt: string | null;
}

export interface CouponValidateRequest {
	code: string;
	subtotal: number;
}

export interface CouponValidation {
	code: string;
	kind: CouponKind;
	value: number;
	discountAmount: number;
}

export interface WishlistEntry {
	product: ProductView;
	createdAt: string;
}

export interface WishlistToggleResult {
	added: boolean;
}

export interface SalesTotals {
	revenue: number;
	orders: number;
	avgOrder: number;
}

export interface RevenueByDay {
	day: string;
	revenue: number;
}

export interface TopProduct {
	productId: number;
	name: string;
	quantity: number;
	revenue: number;
}

export interface SalesReport {
	totals: SalesTotals;
	revenueByStatus: Record<OrderStatus, number>;
	countsByStatus: Record<OrderStatus, number>;
	revenueByDay: RevenueByDay[];
	topProducts: TopProduct[];
}

export interface SalesQuery {
	from?: string;
	to?: string;
}
