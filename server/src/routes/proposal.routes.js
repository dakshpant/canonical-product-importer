import { Router } from "express";
import { reviewProposalHandler } from "../controllers/proposal.controller.js";

const router = Router();

router.post("/:id/review", reviewProposalHandler);

export default router;
