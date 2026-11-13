import { fetchProductPage } from "../../../src/services/scraper/productPage.service.js";

async function main() {
  const urls = ["https://example.com/", "https://www.google.com/search"];

  for (const url of urls) {
    console.log("\nTesting:", url);

    try {
      const result = await fetchProductPage(url);

      console.log("Scraping successful!");
      console.log("Final URL:", result.finalUrl);
      console.log("Robots:", result.robots.reason);
      console.log("HTML Preview:", result.html.slice(0, 200));
    } catch (error) {
      console.log("Scraping blocked/failed:", error.message);
      console.log("Error Code:", error.code || "FETCH_FAILED");
    }
  }
}

main();
