import { prisma } from "../src/config/prisma.js";

async function main() {
  const product = await prisma.product.create({
    data: {
      name: "Test Product",
      sku: "TEST-001",
      price: 100,
      stockLevel: 100,
      safetyStock: 20,
      leadTimeDays: 5
    }
  });

  await prisma.stockMovement.createMany({
    data: [
      { productId: product.id, type: "SALE", quantity: 10 },
      { productId: product.id, type: "SALE", quantity: 5 },
      { productId: product.id, type: "SALE", quantity: 8 }
    ]
  });

  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());