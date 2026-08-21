-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Mechanical Engineer',
    "company" TEXT NOT NULL DEFAULT 'Independent',
    "phone" TEXT,
    "avatar" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'Pro Engineer',
    "address" TEXT,
    "taxId" TEXT,
    "passwordHash" TEXT,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tensileStrength" DOUBLE PRECISION NOT NULL,
    "hdt" DOUBLE PRECISION NOT NULL,
    "elongation" DOUBLE PRECISION NOT NULL,
    "density" DOUBLE PRECISION NOT NULL,
    "standardTolerance" TEXT NOT NULL,
    "minWallThickness" TEXT NOT NULL,
    "leadTime" TEXT NOT NULL,
    "surfaceFinish" TEXT NOT NULL,
    "tags" TEXT[],
    "colorOptions" TEXT[],
    "idealFor" TEXT NOT NULL,
    "isCertified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "quoteId" TEXT,
    "partName" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "date" TEXT NOT NULL,
    "estDelivery" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'In Review',
    "statusBadge" TEXT NOT NULL DEFAULT 'badge-blue',
    "progressStep" INTEGER NOT NULL DEFAULT 1,
    "manufacturingCost" TEXT,
    "serviceFee" TEXT,
    "totalCost" TEXT NOT NULL,
    "tolerance" TEXT NOT NULL DEFAULT '±0.05 mm',
    "provider" TEXT NOT NULL DEFAULT 'SeekMake',
    "providerOrderRef" TEXT,
    "trackingNum" TEXT,
    "history" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "partName" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "toleranceGrade" TEXT DEFAULT 'standard',
    "surfaceFinish" TEXT DEFAULT 'Standard',
    "manufacturingCost" TEXT,
    "serviceFee" TEXT,
    "unitPrice" TEXT NOT NULL,
    "totalPrice" TEXT NOT NULL,
    "leadTime" TEXT NOT NULL,
    "validUntil" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Ready for Approval',
    "provider" TEXT NOT NULL DEFAULT 'SeekMake',
    "providerQuoteRef" TEXT,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "uploaded" TEXT NOT NULL,
    "volume" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "meshTriangles" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Verified CAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_files" ADD CONSTRAINT "cad_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
