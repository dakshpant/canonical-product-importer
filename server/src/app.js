import express from "express";
import { errorHandler } from "./middlewares/error.middleware.js";
import productRoutes from "./routes/product.routes.js";
import importRoutes from "./routes/import.routes.js";
import proposalRoutes from "./routes/proposal.routes.js";
const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Product Import API is running",
  });
});

//ROutes
app.use("/api/products", productRoutes);
app.use("/api/imports", importRoutes);
app.use("/api/proposals", proposalRoutes);
// Global error handler — keep this after routes
app.use(errorHandler);

export default app;
