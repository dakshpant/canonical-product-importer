import assert from "node:assert/strict";
import { buildProductExtractionInput } from "./services/scraper/product-extraction-input.service.js";

const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Acme CRM</title>
  <meta name="description" content="A CRM platform for businesses">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Acme CRM",
    "description": "Customer relationship management software",
    "applicationCategory": "BusinessApplication"
  }
  </script>
</head>
<body>
  <main>
    <h1>Acme CRM</h1>
    <p>Manage your customers and sales pipeline.</p>
    <h2>Features</h2>
    <p>Contact management and sales tracking.</p>
  </main>
</body>
</html>
`;

const result = buildProductExtractionInput(
  sampleHtml,
  "https://www.postman.com/",
);

// Check all three extraction outputs
assert.ok(result.metadata);
assert.ok(Array.isArray(result.jsonLdProducts));
assert.ok(result.pageText);

assert.equal(result.url, "https://www.postman.com/");

console.log("All extraction input tests passed!");
console.dir(result, { depth: null });
