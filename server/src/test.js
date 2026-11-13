
import { validateProductExtraction } from "./validators/product-extraction.validator.js";

const result = validateProductExtraction({
  name: "Postman",
  product_kind: "SaaS",
  category: "Developer Tools",
  industry: "Software Development",
  sub_category: "API Management",
  tagline: "API engineering for your agents",
  short_description: "API development platform",
  overview: null,
  website: "https://www.postman.com/",
  image_url: null,
  image_alt: null,
  image_type: null,
  image_source_page: null,
  tags: [],
  skills: [],
  features: ["API testing"],
  deployments: [],
  platforms: [],
  target_customers: [],
  sources: [],
});

console.log(result);
