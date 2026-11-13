import {
  getProducts,
  getProductById,
  getProposalById,
  updateProduct as updateProductService,
  approveProduct as approveProductService,
  rejectProduct as rejectProductService,
} from "../services/product/product.service.js";

// GET /api/products  ->  { products }, each with pending_proposals
export async function listProducts(req, res, next) {
  try {
    const products = await getProducts();

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/products/:id  ->  { product } with sources, import_records, update_proposals
export async function getProduct(req, res, next) {
  try {
    const product = await getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/products/proposals/:proposalId  ->  { proposal } with product and evidence
export async function getProposal(req, res, next) {
  try {
    const proposal = await getProposalById(req.params.proposalId);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found.",
      });
    }

    return res.status(200).json({
      success: true,
      proposal,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await updateProductService(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveProduct(req, res, next) {
  try {
    const product = await approveProductService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Product approved successfully.",
      product,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/products/:id/reject  ->  { product } with status DRAFT
export async function rejectProduct(req, res, next) {
  try {
    const product = await rejectProductService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Product rejected. It is back in Draft.",
      product,
    });
  } catch (error) {
    next(error);
  }
}
