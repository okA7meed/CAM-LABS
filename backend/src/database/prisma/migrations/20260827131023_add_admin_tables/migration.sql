-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "availability" TEXT NOT NULL DEFAULT 'IN_STOCK',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pricePerUnit" DOUBLE PRECISION,
ADD COLUMN     "priceUnit" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "actualDelivery" TEXT,
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "manufacturerId" TEXT,
ADD COLUMN     "manufacturingStatus" TEXT NOT NULL DEFAULT 'Pending',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
ADD COLUMN     "pricingEquationVersionId" TEXT,
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "shippingCost" TEXT,
ADD COLUMN     "shippingMethod" TEXT,
ADD COLUMN     "shippingStatus" TEXT NOT NULL DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "convertedOrderId" TEXT,
ADD COLUMN     "pricingEquationVersionId" TEXT;

-- CreateTable
CREATE TABLE "pricing_equations" (
    "id" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentPublishedId" TEXT,
    "draftVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_equations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_equation_versions" (
    "id" TEXT NOT NULL,
    "equationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "formulaTree" JSONB NOT NULL,
    "customVariables" JSONB,
    "constantsSnapshot" JSONB,
    "breakdownConfig" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_equation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_variables" (
    "id" TEXT NOT NULL,
    "technology" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'number',
    "formulaTree" JSONB,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_constants" (
    "id" TEXT NOT NULL,
    "technology" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_constants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tests" (
    "id" TEXT NOT NULL,
    "equationId" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "cadFileId" TEXT,
    "inputParams" JSONB NOT NULL,
    "draftResult" JSONB,
    "publishedResult" JSONB,
    "comparison" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_publications" (
    "id" TEXT NOT NULL,
    "equationId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "notes" TEXT,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "address" TEXT,
    "supportedTechnologies" TEXT[],
    "supportedMaterials" TEXT[],
    "capacity" INTEGER,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentOrders" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "performanceRating" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "technology" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "requiredDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "estimatedCompletion" TEXT,
    "actualCompletion" TEXT,

    CONSTRAINT "manufacturing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "paymentMethod" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "refundedAmount" DOUBLE PRECISION DEFAULT 0,
    "refundReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_equations_technology_key" ON "pricing_equations"("technology");

-- CreateIndex
CREATE INDEX "pricing_equation_versions_equationId_status_idx" ON "pricing_equation_versions"("equationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_equation_versions_equationId_version_key" ON "pricing_equation_versions"("equationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_variables_code_key" ON "pricing_variables"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_constants_key_key" ON "pricing_constants"("key");

-- CreateIndex
CREATE INDEX "pricing_tests_equationId_createdAt_idx" ON "pricing_tests"("equationId", "createdAt");

-- CreateIndex
CREATE INDEX "pricing_publications_equationId_publishedAt_idx" ON "pricing_publications"("equationId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_companyName_key" ON "manufacturers"("companyName");

-- CreateIndex
CREATE INDEX "manufacturers_status_idx" ON "manufacturers"("status");

-- CreateIndex
CREATE INDEX "manufacturers_availability_idx" ON "manufacturers"("availability");

-- CreateIndex
CREATE INDEX "manufacturing_requests_orderId_idx" ON "manufacturing_requests"("orderId");

-- CreateIndex
CREATE INDEX "manufacturing_requests_manufacturerId_idx" ON "manufacturing_requests"("manufacturerId");

-- CreateIndex
CREATE INDEX "manufacturing_requests_status_idx" ON "manufacturing_requests"("status");

-- CreateIndex
CREATE INDEX "order_events_orderId_idx" ON "order_events"("orderId");

-- CreateIndex
CREATE INDEX "order_events_eventType_idx" ON "order_events"("eventType");

-- CreateIndex
CREATE INDEX "order_events_createdAt_idx" ON "order_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_paymentStatus_idx" ON "payments"("paymentStatus");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_notifications_userId_idx" ON "admin_notifications"("userId");

-- CreateIndex
CREATE INDEX "admin_notifications_isRead_idx" ON "admin_notifications"("isRead");

-- CreateIndex
CREATE INDEX "admin_notifications_type_idx" ON "admin_notifications"("type");

-- CreateIndex
CREATE INDEX "admin_notifications_createdAt_idx" ON "admin_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "orders_manufacturerId_idx" ON "orders"("manufacturerId");

-- CreateIndex
CREATE INDEX "orders_pricingEquationVersionId_idx" ON "orders"("pricingEquationVersionId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "quotes_pricingEquationVersionId_idx" ON "quotes"("pricingEquationVersionId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_accountStatus_idx" ON "users"("accountStatus");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricingEquationVersionId_fkey" FOREIGN KEY ("pricingEquationVersionId") REFERENCES "pricing_equation_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_pricingEquationVersionId_fkey" FOREIGN KEY ("pricingEquationVersionId") REFERENCES "pricing_equation_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_equation_versions" ADD CONSTRAINT "pricing_equation_versions_equationId_fkey" FOREIGN KEY ("equationId") REFERENCES "pricing_equations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tests" ADD CONSTRAINT "pricing_tests_equationId_fkey" FOREIGN KEY ("equationId") REFERENCES "pricing_equations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_publications" ADD CONSTRAINT "pricing_publications_equationId_fkey" FOREIGN KEY ("equationId") REFERENCES "pricing_equations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_publications" ADD CONSTRAINT "pricing_publications_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "pricing_equation_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_requests" ADD CONSTRAINT "manufacturing_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_requests" ADD CONSTRAINT "manufacturing_requests_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
