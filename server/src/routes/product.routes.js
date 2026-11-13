import { Router } from "express";
import {
  listProducts,
  getProduct,
  getProposal,
  updateProduct,
  approveProduct,
  rejectProduct,
} from "../controllers/product.controller.js";
const router = Router();

router.get("/", listProducts);
router.get("/:id", getProduct);
router.get("/proposals/:proposalId", getProposal);
router.patch("/:id", updateProduct);
router.post("/:id/approve", approveProduct);
router.post("/:id/reject", rejectProduct);

export default router;
