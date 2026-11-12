
import { validateUrlBatch } from "./validators/url.validator.js";

const urls = [
  "https://example.com",
  "https://google.com",
  "not-a-url",
  "https://example.com#overview",
  "https://example.com#features",
  "ftp://example.com",
];

console.log(JSON.stringify(validateUrlBatch(urls), null, 2));
