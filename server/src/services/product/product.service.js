import { randomUUID } from "node:crypto";

import prisma from "../../config/prisma.js";
import { PRODUCT_STATUS, PROPOSAL_STATUS } from "../../constants/status.js";
import { PRODUCT_EXTRACTION_FIELDS } from "../../validators/product-extraction.validator.js";
import {
  APP_OWNED_FIELDS,
  buildProposalUpdate,
  hasValue,
} from "./proposal-update.js";
import {
  formatUpdateError,
  productUpdateSchema,
} from "../../validators/product-update.validator.js";
function normalizeUrl(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol)) return null;

    url.hash = "";

    // URL automatically normalizes hostname casing and default ports.
    return url.toString();
  } catch {
    return null;
  }
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(tx, name) {
  const base = slugify(name) || `product-${randomUUID().slice(0, 8)}`;

  let slug = base;
  let suffix = 2;

  while (await tx.product.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function getProductData(extractedData) {
  const data = {};

  for (const field of PRODUCT_EXTRACTION_FIELDS) {
    if (APP_OWNED_FIELDS.has(field)) continue;

    if (Object.hasOwn(extractedData, field)) {
      data[field] = extractedData[field];
    }
  }

  return data;
}

function getSupportedProposalData(extractedData) {
  const data = getProductData(extractedData);

  // Do not propose empty values that could erase existing product data.
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => hasValue(value)),
  );
}

function getSourceData(sources = []) {
  return sources
    .filter(
      (source) =>
        source.field_name &&
        source.source_url &&
        source.evidence_text &&
        source.extracted_value !== undefined,
    )
    .map((source) => ({
      field_name: source.field_name,
      extracted_value: source.extracted_value,
      evidence_text: source.evidence_text,
      source_type: source.source_type ?? null,
      source_url: source.source_url,
    }));
}

async function findExistingProduct(tx, urls) {
  const candidates = [...new Set(urls.map(normalizeUrl).filter(Boolean))];

  if (candidates.length === 0) return null;

  return tx.product.findFirst({
    where: {
      OR: [
        { website: { in: candidates } },
        {
          sources: {
            some: {
              source_url: { in: candidates },
            },
          },
        },
      ],
    },
  });
}

/**
 * Persist verified AI extraction.
 *
 * New product:
 *   Product + ProductSource + ImportRecord link.
 *
 * Existing product:
 *   ProductUpdateProposal + ProductSource + ImportRecord link.
 *
 * Existing Product fields are never changed here.
 */
export async function persistExtractedProduct(importRecord, extractedData) {
  if (!importRecord?.id || !importRecord?.url) {
    throw new Error("A valid import record is required.");
  }

  if (!extractedData || typeof extractedData !== "object") {
    throw new Error("Valid extracted product data is required.");
  }

  const extractedProduct = extractedData.product;

  if (!extractedProduct || typeof extractedProduct !== "object") {
    throw new Error("Extracted product fields are missing.");
  }

  const productData = getProductData(extractedProduct);
  const proposalData = getSupportedProposalData(extractedProduct);
  const sources = getSourceData(extractedData.sources);

  return prisma.$transaction(async (tx) => {
    // Match using exact normalized URLs, never product names.
    const existingProduct = await findExistingProduct(tx, [
      importRecord.url,
      extractedProduct.website,
    ]);

    if (existingProduct) {
      const proposal = await tx.productUpdateProposal.create({
        data: {
          product_id: existingProduct.id,
          import_record_id: importRecord.id,
          proposed_data: proposalData,
        },
      });

      if (sources.length > 0) {
        await tx.productSource.createMany({
          data: sources.map((source) => ({
            ...source,
            product_id: existingProduct.id,
            import_record_id: importRecord.id,
          })),
        });
      }

      await tx.importRecord.update({
        where: { id: importRecord.id },
        data: { product_id: existingProduct.id },
      });

      return {
        type: "UPDATE_PROPOSAL",
        productId: existingProduct.id,
        proposalId: proposal.id,
      };
    }

    // Product.name and Product.slug are required by the database.
    // Never invent a name when extraction did not find one.
    if (!hasValue(productData.name)) {
      return {
        type: "INCOMPLETE",
        reason: "MISSING_PRODUCT_NAME",
        productId: null,
      };
    }

    const isComplete =
      hasValue(productData.name) &&
      hasValue(productData.category) &&
      hasValue(productData.short_description);

    const slug = await generateUniqueSlug(tx, productData.name);

    const product = await tx.product.create({
      data: {
        ...productData,
        slug,
        sku_id: null,
        unit_of_measure: null,
        min_quantity: null,
        max_quantity: null,
        status: isComplete ? PRODUCT_STATUS.UNDER_REVIEW : PRODUCT_STATUS.DRAFT,
      },
    });

    if (sources.length > 0) {
      await tx.productSource.createMany({
        data: sources.map((source) => ({
          ...source,
          product_id: product.id,
          import_record_id: importRecord.id,
        })),
      });
    }

    await tx.importRecord.update({
      where: { id: importRecord.id },
      data: { product_id: product.id },
    });

    return {
      type: "NEW_PRODUCT",
      productId: product.id,
      status: product.status,
    };
  });
}

/**
 * All products, newest first. Each carries pending_proposals: the number of
 * refresh proposals still waiting for the admin.
 */

export async function getProducts() {
  const products = await prisma.product.findMany({
    orderBy: {
      created_at: "desc",
    },
    include: {
      _count: {
        select: {
          update_proposals: {
            where: {
              status: PROPOSAL_STATUS.PENDING,
            },
          },
        },
      },
      update_proposals: {
        where: {
          status: PROPOSAL_STATUS.PENDING,
        },
        orderBy: {
          created_at: "desc",
        },
        take: 1,
        select: {
          id: true,
        },
      },
    },
  });

  return products.map(({ _count, update_proposals, ...product }) => ({
    ...product,
    pending_proposals: _count.update_proposals,
    pending_proposal_id: update_proposals[0]?.id ?? null,
  }));
}

/**
 * Fetch one product by ID, including its pending proposal count.
 */
/**
 * One product for the review screen, with:
 * - sources: the evidence for every field (oldest first)
 * - import_records: the imports that produced or refreshed it (newest first)
 * - update_proposals: refresh proposals still waiting for the admin
 * - pending_proposals: their count, as in the product list
 * Returns null if the product does not exist.
 */
export async function getProductById(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      sources: {
        orderBy: { created_at: "asc" },
      },
      import_records: {
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          url: true,
          status: true,
          batch_id: true,
          created_at: true,
        },
      },
      update_proposals: {
        where: { status: PROPOSAL_STATUS.PENDING },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!product) return null;

  return {
    ...product,
    pending_proposals: product.update_proposals.length,
  };
}

/**
 * Fetch one update proposal (any status) with its product and the evidence
 * collected by the re-scrape that created it. Returns null if it does not exist.
 */
export async function getProposalById(proposalId) {
  const proposal = await prisma.productUpdateProposal.findUnique({
    where: {
      id: proposalId,
    },
    include: {
      product: true,
      import_record: {
        include: {
          sources: true,
        },
      },
    },
  });

  if (!proposal) {
    return null;
  }

  return {
    id: proposal.id,
    status: proposal.status,
    proposed_data: proposal.proposed_data,
    reviewed_fields: proposal.reviewed_fields,
    created_at: proposal.created_at,
    product: proposal.product,
    sources: proposal.import_record.sources,
    import_record: {
      id: proposal.import_record.id,
      url: proposal.import_record.url,
      status: proposal.import_record.status,
    },
  };
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Apply the admin's refresh decisions.
 *
 * decisions: { [field]: "current" | "proposed" }
 * - Only fields set to "proposed" with a non-empty new value are written.
 * - The product's status is never changed here.
 * - The proposal becomes APPROVED if anything was applied, else REJECTED.
 * - Older pending proposals for the same product are superseded (REJECTED),
 *   since the admin has now decided on newer data.
 *
 * Returns the updated product (same shape as getProductById).
 */
export async function reviewProposal(proposalId, decisions) {
  const productId = await prisma.$transaction(async (tx) => {
    const proposal = await tx.productUpdateProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) throw httpError(404, "Proposal not found.");
    if (proposal.status !== PROPOSAL_STATUS.PENDING) {
      throw httpError(
        409,
        `This refresh was already reviewed (${proposal.status}).`,
      );
    }

    // Validates decisions and drops blank values (throws 400 when invalid).
    const { updates, applied } = buildProposalUpdate(
      proposal.proposed_data,
      decisions,
    );

    if (applied.length > 0) {
      await tx.product.update({
        where: { id: proposal.product_id },
        data: updates,
      });
    }

    const reviewedAt = new Date();

    await tx.productUpdateProposal.update({
      where: { id: proposal.id },
      data: {
        status:
          applied.length > 0
            ? PROPOSAL_STATUS.APPROVED
            : PROPOSAL_STATUS.REJECTED,
        reviewed_fields: decisions,
        reviewed_at: reviewedAt,
      },
    });

    await tx.productUpdateProposal.updateMany({
      where: {
        product_id: proposal.product_id,
        status: PROPOSAL_STATUS.PENDING,
        created_at: { lt: proposal.created_at },
      },
      data: {
        status: PROPOSAL_STATUS.REJECTED,
        reviewed_at: reviewedAt,
      },
    });

    return proposal.product_id;
  });

  return getProductById(productId);
}

// Required for a product to be approved (and to stay Active).
const REQUIRED_FOR_ACTIVE = ["name", "category", "short_description"];

const missingRequiredFields = (product) =>
  REQUIRED_FOR_ACTIVE.filter((field) => !hasValue(product[field]));

async function findProductOr404(tx, productId) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw httpError(404, "Product not found.");
  return product;
}

/**
 * Admin edits. Only the fields sent are changed; status, sku_id and slug
 * cannot be edited here. Returns the product as getProductById does.
 */
export async function updateProduct(productId, input) {
  const parsed = productUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw httpError(400, formatUpdateError(parsed.error));
  }

  const changes = parsed.data;

  await prisma.$transaction(async (tx) => {
    const current = await findProductOr404(tx, productId);
    const next = { ...current, ...changes };

    // Checked against the stored value when only one side is sent.
    if (
      next.min_quantity != null &&
      next.max_quantity != null &&
      next.min_quantity > next.max_quantity
    ) {
      throw httpError(400, "min_quantity cannot be greater than max_quantity.");
    }

    // A live product must keep its required fields.
    const missing = missingRequiredFields(next);
    if (current.status === PRODUCT_STATUS.ACTIVE && missing.length > 0) {
      throw httpError(
        400,
        `An Active product needs ${missing.join(", ")}. Reject it first to clear these.`,
      );
    }

    await tx.product.update({ where: { id: productId }, data: changes });
  });

  return getProductById(productId);
}

/** Admin decision: Active. Refused if a required field is empty. */
export async function approveProduct(productId) {
  await prisma.$transaction(async (tx) => {
    const product = await findProductOr404(tx, productId);
    const missing = missingRequiredFields(product);

    if (missing.length > 0) {
      throw httpError(
        400,
        `Cannot approve product. Missing required fields: ${missing.join(", ")}.`,
      );
    }

    await tx.product.update({
      where: { id: productId },
      data: { status: PRODUCT_STATUS.ACTIVE },
    });
  });

  return getProductById(productId);
}

/** Admin decision: back to Draft. The product's values are kept. */
export async function rejectProduct(productId) {
  await prisma.$transaction(async (tx) => {
    await findProductOr404(tx, productId);
    await tx.product.update({
      where: { id: productId },
      data: { status: PRODUCT_STATUS.DRAFT },
    });
  });

  return getProductById(productId);
}
