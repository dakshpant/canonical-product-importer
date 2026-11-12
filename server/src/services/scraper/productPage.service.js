import { checkRobotsPermission } from "./robot.service.js";
import { fetchPage } from "./scraper.service.js";
import { ScrapeError } from "./scrape-error.js";

async function assertRobotsAllowed(url) {
  const permission = await checkRobotsPermission(url);

  if (!permission.allowed) {
    throw new ScrapeError(
      permission.reason,
      `Scraping not permitted: ${permission.reason}`,
      { url, ...permission },
    );
  }

  return permission;
}

export async function fetchProductPage(inputUrl) {
  // First, check whether our crawler is allowed.
  const permission = await assertRobotsAllowed(inputUrl);

  // Re-check robots.txt for every redirect target, so a redirect to
  // another path or another site can't bypass its rules.
  const page = await fetchPage(inputUrl, {
    onRedirect: (_fromUrl, toUrl) => assertRobotsAllowed(toUrl),
  });

  return {
    ...page,
    robots: permission,
  };
}
