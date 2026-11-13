// Seed a small "existing catalogue": products an admin already approved,
// with values they entered by hand. Their URLs have recorded LLM answers
// (server/recordings/), so re-scraping them works without an API key and
// shows the refresh flow preserving existing values:
//   - fields left empty here (tagline, features, ...) are offered from the page;
//   - the admin's own wording is shown next to the page's, and kept unless
//     the admin chooses otherwise;
//   - admin-only fields (unit_of_measure, min/max_quantity) are never touched.
//
// Safe to run more than once: a product whose website is already in the
// catalogue is skipped, so it never overwrites anything.
//
// Run: npm run seed   (also run by npm run setup)
import prisma from "../src/config/prisma.js";
import { PRODUCT_STATUS } from "../src/constants/status.js";
import { generateUniqueSkuId } from "../src/services/product/identifiers.js";

const SEED_PRODUCTS = [
  {
    name: "Jira",
    slug: "jira",
    product_kind: "Software",
    category: "Project management",
    short_description: "Project and issue tracking for software teams.",
    website: "https://www.atlassian.com/software/jira",
    unit_of_measure: "user / month",
    min_quantity: 1,
    max_quantity: 50000,
    tags: ["Agile"],
  },
  {
    name: "HubSpot CRM",
    slug: "hubspot-crm",
    product_kind: "Software",
    category: "CRM",
    short_description: "CRM for managing contacts, deals and the sales pipeline.",
    website: "https://www.hubspot.com/products/crm",
    unit_of_measure: "seat / month",
    min_quantity: 1,
    max_quantity: 1000,
    platforms: ["Web"],
  },
  {
    name: "Zendesk",
    slug: "zendesk",
    product_kind: "Software",
    category: "Customer support",
    short_description: "Help desk and customer service software.",
    website: "https://www.zendesk.com/service/",
    unit_of_measure: "agent / month",
    min_quantity: 1,
    max_quantity: 5000,
  },
];

async function uniqueSlug(base) {
  let slug = base;
  for (let n = 2; await prisma.product.findUnique({ where: { slug } }); n += 1) {
    slug = `${base}-${n}`;
  }
  return slug;
}

async function main() {
  let created = 0;

  for (const seed of SEED_PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { website: seed.website } });
    if (existing) {
      console.log(`  skip    ${seed.name} (already in the catalogue)`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        ...seed,
        slug: await uniqueSlug(seed.slug),
        sku_id: await generateUniqueSkuId(prisma),
        status: PRODUCT_STATUS.ACTIVE,
      },
    });
    created += 1;
    console.log(`  created ${product.name} (${product.sku_id}, Active)`);
  }

  console.log(`Seed done: ${created} created, ${SEED_PRODUCTS.length - created} skipped.`);
}

try {
  await main();
} catch (error) {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
