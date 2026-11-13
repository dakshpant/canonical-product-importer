// Thin client for the backend API. Every request goes to our own server;
// the browser never fetches vendor pages itself.
//
// The endpoint contract is documented in docs/api-contract.md.
// Field names are the canonical snake_case names, unchanged.

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Is the backend running?");
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok || data?.success === false) {
    const message =
      data?.error?.message ??
      data?.error ??
      data?.message ??
      `Request failed (HTTP ${response.status}).`;
    throw new ApiError(String(message), {
      status: response.status,
      details: data?.details,
    });
  }

  return data;
}

// --- Imports --------------------------------------------------------------

export const api = {
  /** Start an import. Returns the created batch with its records. */
  createImport: (urls) =>
    request("/imports", { method: "POST", body: { urls } }).then(
      (d) => d.batch,
    ),

  /** All import batches, newest first. */
  listImports: () => request("/imports").then((d) => d.batches),

  /** One batch with its records (polled while it runs). */
  getImport: (batchId) => request(`/imports/${batchId}`).then((d) => d.batch),

  // --- Products -------------------------------------------------------------

  /** All products (filtering is done on the client; single admin, small catalogue). */
  listProducts: () => request("/products").then((d) => d.products),

  /** One product with its sources, import records and pending refresh proposals. */
  getProduct: (productId) =>
    request(`/products/${productId}`).then((d) => d.product),

  /** Save admin edits. Only the changed fields are sent. */
  updateProduct: (productId, changes) =>
    request(`/products/${productId}`, { method: "PATCH", body: changes }).then(
      (d) => d.product,
    ),

  /** Admin decision: Active. The backend re-validates required fields. */
  approveProduct: (productId) =>
    request(`/products/${productId}/approve`, { method: "POST" }).then(
      (d) => d.product,
    ),

  /** Admin decision: back to Draft. */
  rejectProduct: (productId) =>
    request(`/products/${productId}/reject`, { method: "POST" }).then(
      (d) => d.product,
    ),

  // --- Refresh proposals ------------------------------------------------------

  /**
   * Resolve a refresh proposal.
   * decisions: { [field]: "current" | "proposed" }
   */
  reviewProposal: (proposalId, decisions) =>
    request(`/proposals/${proposalId}/review`, {
      method: "POST",
      body: { decisions },
    }).then((d) => d.product),

  /** One proposal with its product, proposed values and evidence. */
  getProposal: (proposalId) =>
    request(`/products/proposals/${proposalId}`).then((d) => d.proposal),
};
