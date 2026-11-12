import { fetchPage } from "./services/scraper/scraper.service.js";

async function main() {
  try {
    const result = await fetchPage(
      "https://httpbin.org/redirect-to?url=https%3A%2F%2Fexample.com",
    );
    console.log("Status:", result.statusCode);
    console.log("Final URL:", result.finalUrl);
    console.log("Content Type:", result.contentType);
    console.log("HTML Preview:\n", result.html.slice(0, 500));
  } catch (error) {
    console.error("Scraping failed:", error.message);
  }
}

main();
