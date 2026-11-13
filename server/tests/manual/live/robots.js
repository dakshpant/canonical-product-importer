import { checkRobotsPermission } from "../../../src/services/scraper/robot.service.js";

async function main() {
  const urls = ["https://example.com/", "https://www.google.com/search"];

  for (const url of urls) {
    console.log("\nChecking:", url);

    const result = await checkRobotsPermission(url);

    console.log(result);
  }
}

main();
