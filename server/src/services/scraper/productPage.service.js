
import { checkRobotsPermission } from "./robot.service.js";
import { fetchPage } from "./scraper.service.js";

export async function fetchProductPage(inputUrl) {
  // First, check whether our crawler is allowed.
  const permission = await checkRobotsPermission(inputUrl);

  if (!permission.allowed) {
    const error = new Error(
      `Scraping not permitted: ${permission.reason}`
    );

    error.code = permission.reason;
    error.details = permission;

    throw error;
  }

  // Only fetch the actual page if permission is granted.
  const page = await fetchPage(inputUrl);

  return {
    ...page,
    robots: permission,
  };
}
