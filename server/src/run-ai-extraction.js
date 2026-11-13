// Live demo: run one real URL through the full pipeline and print the
// structured product data the LLM produced. Makes ONE real Groq call
// (uses your GROQ_API_KEY and free-tier tokens). Nothing is saved.
//
// Run: node src/run-ai-extraction.js https://www.hubspot.com/products/crm
import { prepareExtractionInput } from "./services/scraper/product-extraction-input.service.js";
import { extractProduct } from "./services/ai/extraction.service.js";

const url = process.argv[2] || "https://www.hubspot.com/products/crm";

try {
  console.log(`\n1. Scraping ${url} ...`);
  const input = await prepareExtractionInput(url);
  console.log(
    `   OK: ${input.signals.textLength} chars of text, ${input.jsonLdProducts.length} JSON-LD node(s)`,
  );

  console.log("\n2. Asking the LLM for canonical product data ...");
  const result = await extractProduct(input, null, {
    sleep: (ms) => {
      console.log(`   rate limited, waiting ${ms / 1000}s ...`);
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  });

  const { product, sources, review, extraction } = result.data;

  console.log(`\n3. Import record status: ${result.status}`);

  console.log("\n--- product (canonical fields) ---");
  console.log(JSON.stringify(product, null, 2));

  console.log("\n--- sources (evidence for each value) ---");
  for (const s of sources) {
    console.log(`  ${s.field_name} = ${JSON.stringify(s.extracted_value)}`);
    console.log(`      from ${s.source_type}: "${s.evidence_text.slice(0, 120)}"`);
  }

  console.log("\n--- review notes for the admin ---");
  console.log(JSON.stringify(review, null, 2));

  console.log("\n--- extraction info ---");
  console.log(JSON.stringify(extraction, null, 2));
} catch (error) {
  console.error(`\nFAILED: ${error.code ?? "ERROR"} - ${error.message}`);
  process.exitCode = 1;
}
