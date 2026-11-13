import { reviewProposal } from "../services/product/product.service.js";

// POST /api/proposals/:id/review  { decisions }  ->  { product }
export async function reviewProposalHandler(req, res, next) {
  try {
    const product = await reviewProposal(req.params.id, req.body?.decisions);

    return res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
}
