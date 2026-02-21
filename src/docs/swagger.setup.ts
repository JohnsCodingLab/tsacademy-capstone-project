import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Express } from "express";
import { logger } from "@/libs/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Register the Swagger UI route on the Express app.
 *
 * Docs are served at: GET /api/v1/docs
 * Raw spec is at:     GET /api/v1/docs/spec
 *
 * In production you may want to gate this behind an IP allowlist
 * or remove it entirely. Control via the NODE_ENV guard below.
 */
export function setupSwagger(app: Express): void {
  try {
    const specPath = join(__dirname, "swagger.yaml");
    const swaggerSpec = YAML.load(specPath);

    const uiOptions: swaggerUi.SwaggerUiOptions = {
      customSiteTitle: "S.I.S.M.S API Docs",
      customCss: `
        .topbar { background-color: #1a1a2e; }
        .topbar-wrapper img { content: url(''); }
        .swagger-ui .info .title { color: #e94560; }
      `,
      swaggerOptions: {
        persistAuthorization: true, // keeps the Bearer token across page refreshes
        displayRequestDuration: true, // shows response time on each request
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        docExpansion: "none", // all tags collapsed by default — less overwhelming
        filter: true, // enables the search/filter bar
        tryItOutEnabled: true, // "Try it out" open by default
      },
    };

    // Serve the UI
    app.use(
      "/api/v1/docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, uiOptions),
    );

    // Serve the raw JSON spec (useful for Postman / Insomnia imports)
    app.get("/api/v1/docs/spec", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });

    logger.info("📄 Swagger docs available at /api/v1/docs");
  } catch (err) {
    // Never crash the app if Swagger fails to load
    logger.error({ err }, "Failed to load Swagger documentation");
  }
}
