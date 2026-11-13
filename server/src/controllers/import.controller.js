import {
  createImportBatch,
  getImportBatch,
  getImportBatches,
} from "../services/product/import.service.js";
import { processImportBatch } from "../services/product/import-processor.service.js";
import { extractProduct } from "../services/ai/extraction.service.js";

// POST /api/imports  { urls: string[] }  ->  202 { batch }
// The batch is created and returned straight away; URLs are processed in the
// background so the admin can follow progress via GET /api/imports/:id.
export async function importProducts(req, res, next) {
  try {
    const { urls } = req.body ?? {};

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one product URL.",
      });
    }

    const creation = await createImportBatch(urls);

    if (!creation.success) {
      return res.status(400).json({
        success: false,
        message: creation.error ?? "The URLs could not be validated.",
      });
    }

    const batchId = creation.batch.id;

    // Fire and forget. Per-URL failures are already contained in the
    // processor; this only catches unexpected errors so they are logged.
    processImportBatch(batchId, { extractProduct }).catch((error) => {
      console.error(`Import batch ${batchId} stopped unexpectedly:`, error);
    });

    const batch = await getImportBatch(batchId);

    return res.status(202).json({ success: true, batch });
  } catch (error) {
    next(error);
  }
}

// GET /api/imports  ->  { batches }
export async function listImports(req, res, next) {
  try {
    const batches = await getImportBatches();
    return res.status(200).json({ success: true, batches });
  } catch (error) {
    next(error);
  }
}

// GET /api/imports/:id  ->  { batch } with records
export async function getImport(req, res, next) {
  try {
    const batch = await getImportBatch(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Import not found.",
      });
    }

    return res.status(200).json({ success: true, batch });
  } catch (error) {
    next(error);
  }
}
