import { Router } from "express";
import {
  getImport,
  importProducts,
  listImports,
} from "../controllers/import.controller.js";

const router = Router();

router.post("/", importProducts);
router.get("/", listImports);
router.get("/:id", getImport);

export default router;
