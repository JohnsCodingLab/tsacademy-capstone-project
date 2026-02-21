import { prisma } from "@/config/prisma.js";
import { redis } from "@/config/redis.js";

export async function forecastProduct(productId: string, days = 30) {
  const cacheKey = `forecast:${productId}:${days}`;

  // 1️⃣ Check cache
  const cached = await redis.get(cacheKey);

  if (cached) {
    console.log("⚡ Returning from cache");
    return JSON.parse(cached);
  }

  console.log("📦 Hitting database");

  const since = new Date();
  since.setDate(since.getDate() - days);
const [totalSales, product] = await Promise.all([
  prisma.stockMovement.aggregate({
    _sum: { quantity: true },
    where: {
      productId,
      type: "SALE",
      createdAt: { gte: since }
    }
  }),
  prisma.product.findUnique({
    where: { id: productId }
  })
]);

  if (!product) {
    throw new Error("Product not found");
  }

  const sold = totalSales._sum.quantity ?? 0;
  const dailyVelocity = sold / days;

  let result;

  if (dailyVelocity === 0) {
    result = {
      velocity: 0,
      estimatedOutOfStockDate: null,
      reorderPoint: null,
      shouldReorder: false
    };
  } else {
    const depletionDays = product.stockLevel / dailyVelocity;

    const reorderPoint =
      dailyVelocity * product.leadTimeDays + product.safetyStock;

    result = {
      velocity: Number(dailyVelocity.toFixed(2)),
      estimatedOutOfStockDate: new Date(
        Date.now() + depletionDays * 86400000
      ).toISOString(),
      reorderPoint: Number(reorderPoint.toFixed(2)),
      shouldReorder: product.stockLevel <= reorderPoint
    };
  }

  // 2️⃣ Store in Redis
    await redis.set(cacheKey, JSON.stringify(result));
  await redis.expire(cacheKey, 60);

  return result;
}