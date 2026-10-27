// ─── Shared ───────────────────────────────────────────────────────────────────

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface ErrorResponse {
  errorCode: string;
  message: string;
  timestamp: string;
  traceId: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type Role = "SuperAdmin" | "Owner" | "Manager" | "Seller";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: Role;
  pharmacyId?: string;
  branchId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** Public self-registration form for pharmacy owners */
export interface OwnerRegistrationRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

/** Admin creates any user */
export interface AdminCreateUserRequest {
  email: string;
  password: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  phone?: string;
  pharmacyId?: string;
  branchId?: string;
}

/** Admin edits an existing user */
export interface AdminUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: Role;
  pharmacyId?: string;
  branchId?: string;
  enabled?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserSummary;
}

export interface UserSummary {
  id: string;
  email: string;
  role: Role;
  pharmacyId: string | null;
  branchId: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  pharmacyId: string | null;
  branchId: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  enabled: boolean;
  fullName: string;
  createdAt: string;
}

export interface CreateStaffRequest {
  email: string;
  password: string;
  role: "Manager" | "Seller";
  branchId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UpdateStaffRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  branchId?: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

// ─── Pharmacy ─────────────────────────────────────────────────────────────────

export type PharmacyStatus =
  | "PendingApproval"
  | "Active"
  | "Suspended"
  | "Deactivated"
  | "Rejected";

export interface PharmacyResponse {
  id: string;
  name: string;
  registrationNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  status: PharmacyStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePharmacyRequest {
  name: string;
  registrationNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

export interface UpdatePharmacyRequest {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
}

// ─── Branch ───────────────────────────────────────────────────────────────────

export type BranchStatus = "Active" | "Inactive";

export interface BranchResponse {
  id: string;
  pharmacyId: string;
  pharmacyName: string | null;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  isMain: boolean;
  status: BranchStatus;
  createdAt: string;
}

export interface CreateBranchRequest {
  name: string;
  address?: string;
  phone?: string;
  isMain?: boolean;
}

export interface UpdateBranchRequest {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  region?: string;
}

// ─── Drug Category ────────────────────────────────────────────────────────────

export interface CategoryResponse {
  id: string;
  pharmacyId: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
}

// ─── Drug ─────────────────────────────────────────────────────────────────────

export interface DrugResponse {
  id: string;
  pharmacyId: string;
  name: string;
  genericName: string | null;
  barcode: string | null;
  /** The smallest unit sold (e.g. tablet). Prices, stock and sale quantities are all counted in it. */
  unit: string;
  /** How many `unit`s make one pack (1 = not sold in packs). */
  unitsPerPack: number;
  /** Name of the pack, e.g. "box". Null when unitsPerPack is 1. */
  packUnit: string | null;
  /** Whole or decimal TZS. The API client converts the server's decimal strings to numbers. */
  sellingPrice: number;
  buyingPrice: number | null;
  reorderLevel: number;
  requiresPrescription: boolean;
  categoryId: string | null;
  categoryName: string | null;
  /** The catalog entry this drug was created from; null when it was typed in by hand. */
  catalogItemId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDrugRequest {
  name: string;
  genericName?: string;
  barcode?: string;
  unit: string;
  unitsPerPack?: number;
  packUnit?: string;
  sellingPrice: number;
  buyingPrice: number;
  reorderLevel: number;
  requiresPrescription: boolean;
  categoryId?: string;
}

/**
 * Fields left out are unchanged. Optional details are cleared by sending null; name, unit, selling
 * price, reorder level and the prescription flag can be changed but never blanked.
 */
export interface UpdateDrugRequest {
  name?: string;
  genericName?: string | null;
  barcode?: string | null;
  unit?: string;
  unitsPerPack?: number;
  packUnit?: string | null;
  sellingPrice?: number;
  buyingPrice?: number | null;
  reorderLevel?: number;
  requiresPrescription?: boolean;
  categoryId?: string | null;
}

export interface DrugImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; reason: string }>;
}

// ─── Shared product catalog ───────────────────────────────────────────────────
// What a product IS (name, strength, form, category, barcode). Never a price or a stock level:
// those stay on each pharmacy's own drug.

export type CatalogKind = "Medicine" | "Supplement" | "Cosmetic" | "Device" | "Other";

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  genericName: string | null;
  strength: string | null;
  form: string | null;
  unit: string;
  category: string | null;
  manufacturer: string | null;
  barcode: string | null;
  requiresPrescription: boolean;
  /** Where the entry came from, e.g. "Gene Pharmacy starter list (unverified)". */
  source: string | null;
  sourceRef: string | null;
  /** Checked by a pharmacist at Gene Pharmacy. */
  verified: boolean;
  active: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  /** Only when browsing as a pharmacy: whether this pharmacy already has the item. */
  alreadyAdded?: boolean | null;
  addedAs?: string | null;
}

export interface CatalogFacets {
  kinds: { name: string; count: number }[];
  categories: { name: string; count: number }[];
}

export interface AddFromCatalogEntry {
  catalogItemId: string;
  sellingPrice: number;
  buyingPrice?: number;
  reorderLevel?: number;
}

export interface AddFromCatalogResult {
  added: DrugResponse[];
  skipped: { catalogItemId: string; name: string | null; reason: string; message: string }[];
}

export interface CatalogImportResult {
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  errors: { row: number; reason: string }[];
  /** True when the file was only checked and nothing was saved. */
  dryRun: boolean;
}

export interface CatalogStats {
  total: number;
  active: number;
  verified: number;
  withBarcode: number;
  byKind: Record<string, number>;
  bySource: Record<string, number>;
}

export interface CatalogItemInput {
  name: string;
  kind?: CatalogKind;
  genericName?: string | null;
  strength?: string | null;
  form?: string | null;
  unit?: string;
  category?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
  requiresPrescription?: boolean;
  verified?: boolean;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type MovementType =
  | "Purchase"
  | "Sale"
  | "ManualAdjustment"
  | "Expiry"
  | "Damage"
  | "Return"
  | "Transfer";

export interface StockResponse {
  id: string;
  pharmacyId: string;
  branchId: string;
  branchName: string;
  drugId: string;
  drugName: string;
  unit: string;
  unitsPerPack: number;
  packUnit: string | null;
  quantity: number;
  reorderLevel: number;
  expiryDate: string | null;
  updatedAt: string;
}

export interface LowStockResponse {
  drugId: string;
  drugName: string;
  branchId: string;
  branchName: string;
  unit: string;
  unitsPerPack: number;
  packUnit: string | null;
  currentQuantity: number;
  /** alias for currentQuantity */
  currentStock: number;
  reorderLevel: number;
}

export interface StockMovementResponse {
  id: string;
  pharmacyId: string;
  branchId: string;
  drugId: string;
  drugName: string;
  movementType: MovementType;
  quantityChange: number;
  /** alias for quantityChange */
  quantity: number;
  quantityAfter: number;
  reference: string | null;
  /** alias for reference */
  referenceNumber: string | null;
  notes: string | null;
  /** display name of who performed the movement */
  performedBy: string;
  createdAt: string;
}

export interface StockAdjustmentRequest {
  drugId: string;
  branchId: string;
  movementType: "Adjustment" | "Expiry" | "Return";
  adjustmentQuantity: number;
  notes?: string;
  /** When adding stock: the expiry date of these units (YYYY-MM-DD). Creates a batch with them. */
  expiryDate?: string;
  /** Printed on the box; generated when left empty. */
  batchNumber?: string;
}

export interface StockTransferRequest {
  fromBranchId: string;
  toBranchId: string;
  drugId: string;
  quantity: number;
  reference?: string;
}

export interface StockTransferResponse {
  pharmacyId: string;
  drugId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  reference: string | null;
  transferredAt: string;
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export type SaleStatus = "Completed" | "Voided" | "Pending";
export type SalePaymentMethod = "Cash" | "Card" | "MobileMoney" | "Insurance" | "Credit";

export interface SaleItemRequest {
  drugId: string;
  quantity: number;
  unitPrice: number;
  /** Fixed monetary discount amount for this line (not a percentage) */
  discountAmount: number;
}

export interface CreateSaleRequest {
  branchId: string;
  /** UUID of the logged-in user processing the sale */
  soldBy: string;
  /** Unique receipt identifier, e.g. RCP-20260225-001 */
  receiptNumber: string;
  paymentMethod: SalePaymentMethod;
  /** Amount tendered by the customer */
  amountPaid: number;
  /** Optional sale-level discount (monetary, not percentage) */
  discountAmount?: number;
  notes?: string;
  items: SaleItemRequest[];
}

export interface SaleItemResponse {
  id: string;
  drugId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export interface SaleResponse {
  id: string;
  pharmacyId: string;
  branchId: string;
  soldBy: string;
  receiptNumber: string;
  /** ISO datetime string, e.g. "2026-02-25T14:30:00" */
  saleDate: string;
  status: SaleStatus;
  paymentMethod: SalePaymentMethod;
  /** Sum of all item line totals before sale-level discount */
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  amountPaid: number;
  changeAmount: number;
  notes: string | null;
  voidReason: string | null;
  items: SaleItemResponse[];
}

export interface SaleSummaryResponse {
  id: string;
  branchId: string;
  soldBy: string;
  receiptNumber: string;
  /** ISO datetime string */
  saleDate: string;
  status: SaleStatus;
  paymentMethod: SalePaymentMethod;
  netAmount: number;
  totalItems: number;
}

export interface VoidSaleRequest {
  reason: string;
}

// ─── Shift ───────────────────────────────────────────────────────────────────

export type ShiftStatus = "Open" | "Closed" | "Suspended";

export interface OpenShiftRequest {
  branchId: string;
  openingCash: number;
  notes?: string;
}

export interface CloseShiftRequest {
  closingCash: number;
  /** alias for closingCash */
  closingFloat?: number;
  notes?: string;
}

export interface ShiftResponse {
  id: string;
  pharmacyId: string;
  branchId: string;
  openedBy: string | null;
  closedBy: string | null;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDiscrepancy: number | null;
  totalSalesCount: number;
  totalSalesAmount: number | null;
  notes: string | null;
}

// ─── Supplier ─────────────────────────────────────────────────────────────────

export type SupplierStatus = "Active" | "Suspended" | "Inactive";

export type SupplierPaymentMethod = "Cash" | "BankTransfer" | "MobileMoney" | "Cheque";

export interface SupplierResponse {
  id: string;
  pharmacyId: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  taxNumber: string | null;
  status: SupplierStatus;
  notes: string | null;
  outstandingBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  notes?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  notes?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  reference?: string;
  notes?: string;
  paymentDate: string;
}

export interface SupplierPaymentResponse {
  id: string;
  pharmacyId: string;
  supplierId: string;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  reference: string | null;
  notes: string | null;
  paymentDate: string;
  recordedBy: string | null;
  createdAt: string;
}

// ─── Purchase Order ───────────────────────────────────────────────────────────

export type PurchaseOrderStatus =
  | "Draft"
  | "Ordered"
  | "PartiallyReceived"
  | "Received"
  | "Cancelled";

export interface PurchaseOrderItemRequest {
  drugId: string;
  quantityOrdered: number;
  unitPrice: number;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  branchId: string;
  orderNumber: string;
  orderDate: string;
  expectedDate?: string;
  notes?: string;
  items: PurchaseOrderItemRequest[];
}

export interface ReceiveItemRequest {
  drugId: string;
  quantityReceived: number;
  /** Expiry date printed on the delivery (YYYY-MM-DD). Creates a batch with the received units. */
  expiryDate?: string;
  batchNumber?: string;
}

export interface PurchaseOrderSummaryResponse {
  id: string;
  supplierId: string;
  branchId: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  totalAmount: number;
  totalItems: number;
  createdAt: string;
}

export interface PurchaseOrderItemResponse {
  id: string;
  drugId: string;
  drugName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrderResponse {
  id: string;
  pharmacyId: string;
  supplierId: string;
  branchId: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  totalAmount: number;
  items: PurchaseOrderItemResponse[];
  createdAt: string;
  updatedAt: string;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface SalesSummaryReport {
  totalSales: number;
  totalRevenue: number;
  totalDiscount: number;
  avgSaleValue: number;
  activeBranches: number;
}

export interface DailySalesRow {
  date: string;
  salesCount: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  /** alias for netRevenue used in charts */
  revenue: number;
}

export interface TopDrugRow {
  drugId: string;
  drugName: string;
  totalQuantitySold: number;
  /** alias for totalQuantitySold */
  totalQuantity: number;
  totalRevenue: number;
}

export interface PaymentBreakdownRow {
  paymentMethod: SalePaymentMethod;
  count: number;
  total: number;
  /** alias for total */
  totalAmount: number;
  percentage: number;
}

export interface InventorySummaryReport {
  totalDrugs: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface PurchaseSummaryReport {
  pharmacyId: string;
  from: string;
  to: string;
  totalOrders: number;
  totalSpend: number;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | "LowStock"
  | "ExpiryAlert"
  | "SaleProcessed"
  | "OrderReceived"
  | "SystemAlert";

export type NotificationStatus = "Pending" | "Sent" | "Failed";

export interface NotificationResponse {
  id: string;
  pharmacyId: string;
  type: NotificationType;
  channel: string;
  status: NotificationStatus;
  title: string;
  message: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface NotificationSummaryResponse {
  unreadCount: number;
  totalCount: number;
  latestUnread: Array<{
    id: string;
    type: NotificationType;
    title: string;
    status: string;
    createdAt: string;
  }>;
  latestItems: Array<{
    id: string;
    type: NotificationType;
    title: string;
    status: string;
    createdAt: string;
  }>;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

/**
 * What happened, as the backend records it (e.g. "SaleVoided", "DrugUpdated", "Login"). The list of
 * values that really exist comes from the facets endpoint, not from a fixed list here.
 */
export type AuditAction = string;

export interface AuditLogResponse {
  id: string;
  /** null for platform-level events (a SuperAdmin signing in, a plan price changing). */
  pharmacyId: string | null;
  /** Only on the platform-wide (SuperAdmin) listing. */
  pharmacyName?: string | null;
  actorId: string | null;
  /** null when the system itself did it (e.g. a confirmed payment extending a subscription). */
  actorEmail: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  description: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogSummaryResponse {
  totalCount: number;
  latestItems: AuditLogResponse[];
}

/** The actions and entity types that exist in the log, for filter dropdowns. */
export interface AuditFacets {
  actions: string[];
  entityTypes: string[];
}

export type SystemWarningLevel = "critical" | "warning" | "info";

/** Live measurements from GET /admin/system. Nothing in it is a fixed claim. */
export interface SystemStatus {
  checkedAt: string;
  application: {
    environment: string;
    debug: boolean;
    laravel: string;
    php: string;
    timezone: string;
    url: string;
  };
  database: { reachable: boolean; driver: string; version: string | null; latencyMs: number | null };
  migrations: { applied: number | null; pending: number | null; latest: string | null };
  cache: { store: string; working: boolean };
  scheduler: { lastRunAt: string | null; running: boolean };
  backups: { latestAt: string | null; latestSizeKb: number | null; count: number; offServerCopy: boolean };
  payments: {
    gateway: string;
    configured: boolean;
    checksumEnabled: boolean;
    webhookUrl: string;
    pendingCount: number | null;
    oldestPendingAt: string | null;
  };
  errorTracking: { configured: boolean };
  security: { https: boolean; trustedProxiesConfigured: boolean; frontendProxySecretConfigured: boolean };
  authentication: { accessTokenMinutes: number; refreshTokenDays: number };
  platform: {
    pharmacies: Record<string, number>;
    users: { total: number; enabled: number; disabled: number };
    subscriptions: Record<string, number>;
    plans: { planType: string; active: boolean }[];
  } | null;
  warnings: { level: SystemWarningLevel; message: string }[];
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type PlanType = "Basic" | "Standard" | "Premium" | "Trial";
export type SubscriptionStatus =
  | "Trial"
  | "Active"
  | "GracePeriod"
  | "Expired"
  | "Suspended";

export interface SubscriptionResponse {
  id: string;
  pharmacyId: string;
  planType: PlanType;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  graceEndDate: string | null;
  paymentReference: string | null;
  /** Whole days left until endDate (0 once it has passed). */
  daysRemaining?: number;
  accessGranted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Expiry & Batches ─────────────────────────────────────────────────────────

export type BatchStatus = "Active" | "Depleted" | "Expired" | "Quarantined";

export interface StockBatchResponse {
  id: string;
  pharmacyId: string;
  drugId: string;
  drugName: string;
  branchId: string;
  branchName: string;
  batchNumber: string;
  expiryDate: string;
  initialQuantity: number;
  remainingQuantity: number;
  status: BatchStatus;
  createdAt: string;
}

export interface CreateStockBatchRequest {
  drugId: string;
  branchId: string;
  /** Generated when left empty. */
  batchNumber?: string;
  expiryDate: string;
  initialQuantity: number;
}

export interface NearExpiryItemResponse {
  drugId: string;
  drugName: string;
  branchName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  remainingQuantity: number;
  suggestedMarkdownPrice: number;
  originalPrice: number;
}

export interface ExpiryDashboardResponse {
  expiredCount: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
  totalAtRiskValue: number;
  nearExpiryItems: NearExpiryItemResponse[];
}

export type ReorderUrgency = "Critical" | "High" | "Medium" | "Low";
export type RecommendationStatus = "Pending" | "Accepted" | "Dismissed" | "Superseded";

export interface ReorderRecommendationResponse {
  id: string;
  drugId: string;
  drugName: string;
  branchName: string;
  currentStock: number;
  avgDailyUsage: number;
  daysOfStockRemaining: number;
  suggestedQuantity: number;
  urgency: ReorderUrgency;
  status: RecommendationStatus;
  createdAt: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface CustomerResponse {
  id: string;
  pharmacyId: string;
  name: string;
  phone: string | null;
  email: string | null;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  notes: string | null;
  createdAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  email?: string;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  notes?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  email?: string;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  notes?: string;
}

export interface CustomerFavoriteResponse {
  drugId: string;
  drugName: string;
  purchaseCount: number;
  usualQuantity: number;
  lastPurchasedAt: string;
}

export interface RefillHistoryResponse {
  id: string;
  drugId: string;
  drugName: string;
  quantity: number;
  dosagePerDay: number;
  purchasedAt: string;
  nextRefillDate: string;
  reminderSent: boolean;
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────

export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type LoyaltyTransactionType = "Earn" | "Redeem" | "Bonus" | "Expiry" | "Adjustment";

export interface LoyaltyAccountResponse {
  id: string;
  customerId: string;
  customerName: string;
  pharmacyId: string;
  pointsBalance: number;
  lifetimePointsEarned: number;
  tier: LoyaltyTier;
  pointsToNextTier: number;
  createdAt: string;
}

export interface LoyaltyTransactionResponse {
  id: string;
  loyaltyAccountId: string;
  type: LoyaltyTransactionType;
  points: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

export interface RedeemPointsRequest {
  points: number;
  description?: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/** Money values are decimal strings from the API (e.g. "2000.00"); convert with Number() to display. */
export interface DailySummaryResponse {
  date: string;
  sales: {
    todayCount: number;
    yesterdayCount: number;
    todayRevenue: string;
    yesterdayRevenue: string;
    revenueChange: string;
    totalCost: string;
    grossProfit: string;
    marginPct: string;
    voidedCount: number;
    discounts: string;
  };
  inventory: {
    lowStockCount: number;
    outOfStockCount: number;
    nearExpiryCount: number;
    expiredCount: number;
    expiryLoss: string;
  };
  alerts: {
    criticalReorderCount: number;
    marginLeakageCount: number;
    discountAbuseCount: number;
  };
}

export interface DeadStockItemResponse {
  drugId: string;
  drugName: string;
  genericName: string | null;
  branchId: string;
  branchName: string | null;
  currentStock: number;
  daysSinceLastSale: number;
  lastSoldAt: string | null;
  stockValue: string;
  sellingPrice: string;
  buyingPrice: string | null;
}

export interface MarginLeakageAlertResponse {
  saleId: string;
  receiptNumber: string;
  drugId: string;
  drugName: string;
  quantity: number;
  unitPrice: string;
  buyingPrice: string;
  lossPerUnit: string;
  totalLoss: string;
  soldBy: string | null;
  saleDate: string;
}

export interface BranchScorecardResponse {
  branchId: string;
  branchName: string;
  totalRevenue: string;
  totalCost: string;
  grossProfit: string;
  marginPct: string;
  totalTransactions: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockoutEvents: number;
  averageTransactionValue: string;
}

export interface SellerPerformanceResponse {
  sellerId: string | null;
  sellerName: string;
  role: string | null;
  branchId: string;
  branchName: string | null;
  totalTransactions: number;
  totalRevenue: string;
  totalCost: string;
  grossProfit: string;
  marginPct: string;
  averageTransactionValue: string;
  discounts: string;
  voidedCount: number;
}

// ─── Payment ──────────────────────────────────────────────────────────────────

// Billing: the pharmacy's own Gene Pharmacy subscription, paid for with ClickPesa mobile money.
// (ClickPesa is never used at the till.)
export type BillingPlan = "Basic" | "Standard" | "Premium";
/** Requested = the owner asked for a plan and says they paid; Rejected = Gene Pharmacy declined it. */
export type PaymentStatus = "Pending" | "Requested" | "Completed" | "Failed" | "Cancelled" | "Reversed" | "Rejected";
/** A subscription is bought by the week or by the month. */
export type BillingPeriodUnit = "week" | "month";

/** A plan as the SuperAdmin sees it (including plans that are switched off). */
export interface AdminBillingPlan {
  planType: BillingPlan;
  /** Whole TZS per month, as a string. */
  monthlyPrice: string;
  /** Whole TZS per week; null when the plan is not sold weekly. */
  weeklyPrice: string | null;
  active: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface BillingPlanOffer {
  planType: BillingPlan;
  /** Whole TZS per month, as a string. */
  monthlyPrice: string;
  /** Whole TZS per week, as a string; null when this plan is only sold monthly. */
  weeklyPrice: string | null;
}

export interface BillingOverview {
  subscription: SubscriptionResponse | null;
  plans: BillingPlanOffer[];
  /** How many weeks / months can be bought in one payment. */
  durations: Record<BillingPeriodUnit, number[]>;
  currency: string;
  /** False until ClickPesa credentials and at least one plan price are configured on the server. */
  paymentsEnabled: boolean;
}

/** How a subscription was paid: mobile money in the app, cash recorded by Gene Pharmacy, or a free promotion. */
export type PaymentMethod = "ClickPesa" | "MobileMoney" | "Cash" | "Promotion";

export interface SubscriptionPaymentResponse {
  id: string;
  pharmacyId: string;
  purpose: "Subscription" | null;
  planType: BillingPlan | null;
  periodUnit: BillingPeriodUnit;
  periodCount: number | null;
  /** Ready to show, e.g. "2 weeks" or "5 months". */
  periodLabel: string;
  method: PaymentMethod | null;
  /** Mobile network chosen by ClickPesa, e.g. "TIGO-PESA". */
  channel: string | null;
  status: PaymentStatus;
  /** Whole TZS, as a string. */
  amount: string;
  currency: string;
  phoneNumber: string | null;
  internalReference: string;
  /** The owner's own reference: mobile-money transaction ID or cash receipt number. */
  externalReference: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** A payment as the SuperAdmin sees it: with the pharmacy, who recorded it, and any private note. */
export interface AdminPaymentResponse extends SubscriptionPaymentResponse {
  pharmacyName: string | null;
  /** Receipt / reference written down when the entry was made. */
  externalReference: string | null;
  note: string | null;
  recordedBy: string | null;
}

export interface AdminPaymentSummary {
  from: string;
  to: string;
  /** Whole TZS actually received (cash + mobile money). Promotions are free and failed/voided entries do not count. */
  received: string;
  completedCount: number;
  byMethod: { method: PaymentMethod; count: number; total: string }[];
  pendingCount: number;
  /** Plan requests waiting for a SuperAdmin to confirm the money arrived. */
  requestedCount: number;
  failedCount: number;
  voidedCount: number;
}

/** A subscription row on the SuperAdmin list, with the pharmacy's name and what it has paid. */
export interface AdminSubscriptionRow extends SubscriptionResponse {
  pharmacyName: string | null;
  payments: {
    totalPaid: string;
    paymentCount: number;
    lastPayment: {
      method: PaymentMethod;
      amount: string;
      planType: BillingPlan | null;
      periodUnit: BillingPeriodUnit;
      periodCount: number | null;
      at: string | null;
    } | null;
  };
}

export interface GrantAccessRequest {
  pharmacyId: string;
  kind: "Cash" | "Promotion";
  planType: BillingPlan;
  periodUnit: BillingPeriodUnit;
  /** 1 to 52 weeks, or 1 to 24 months. */
  periodCount: number;
  /** Cash only. Leave out to use the plan's list price for that period. */
  amount?: number;
  /** Receipt number for cash. */
  reference?: string;
  /** Required for a promotion (why); optional for cash. Private to Gene Pharmacy staff. */
  note?: string;
}

/** The owner picks a plan and says how they paid; a SuperAdmin confirms before access starts. */
export interface RequestSubscriptionRequest {
  planType: BillingPlan;
  periodUnit: BillingPeriodUnit;
  periodCount: number;
  method: "MobileMoney" | "Cash";
  /** Mobile-money transaction ID or cash receipt number, if they have one. */
  reference?: string;
  note?: string;
}

export interface PayForSubscriptionRequest {
  planType: BillingPlan;
  periodUnit: BillingPeriodUnit;
  periodCount: number;
  phoneNumber: string;
}

// ─── POS ──────────────────────────────────────────────────────────────────────

export interface BarcodeLookupResponse {
  drugId: string;
  name: string;
  genericName: string | null;
  barcode: string;
  unit: string;
  unitSize: string | null;
  sellingPrice: number;
  stockAvailable: number;
  requiresPrescription: boolean;
}

export interface RepeatPrescriptionResponse {
  previousSaleId: string;
  receiptNumber: string;
  saleDate: string;
  items: Array<{
    drugId: string;
    drugName: string;
    quantity: number;
    unitPrice: number;
    inStock: boolean;
  }>;
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export interface AdminUserStats {
  total: number;
  owners: number;
  managers: number;
  sellers: number;
  enabled: number;
  disabled: number;
}

export interface AdminSubscriptionStats {
  total: number;
  trial: number;
  active: number;
  gracePeriod: number;
  expired: number;
  suspended: number;
}
