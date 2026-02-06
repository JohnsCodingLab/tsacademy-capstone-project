import { prisma } from "./prisma.js";

const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;

    console.log("🟢 PostgreSQL is alive and connected via Driver Adapter");
  } catch (error) {
    console.error("PostgreSQL Connection Failed");
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;
