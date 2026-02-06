import app from "./app.js";
import connectDB from "./config/database.js";
import { env } from "./config/env.js";
import { connectRedis } from "./config/redis.js";

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    await connectRedis();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
    });

    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Startup failed:", error);
    process.exit(1);
  }
};

startServer();
