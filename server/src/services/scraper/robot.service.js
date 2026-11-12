import robotsParser from "robots-parser";
import { fetchResource } from "./scraper.service.js";

const CRAWLER_USER_AGENT = "CanonicalProductImporter";

export async function checkRobotsPermission(inputUrl) {
  const targetUrl = new URL(inputUrl);

  // Every website has its robots.txt at the root.
  const robotsUrl = new URL("/robots.txt", targetUrl.origin).toString();

  let response;

  try {
    response = await fetchResource(robotsUrl);
  } catch (error) {
    return {
      allowed: false,
      reason: "ROBOTS_FETCH_FAILED",
      robotsUrl,
      error: error.message,
    };
  }

  // No robots.txt means no published crawling restrictions.
  if (response.statusCode === 404) {
    return {
      allowed: true,
      reason: "ROBOTS_NOT_FOUND",
      robotsUrl,
    };
  }

  // Conservatively respect explicit access restrictions.
  if ([401, 403].includes(response.statusCode)) {
    return {
      allowed: false,
      reason: "ROBOTS_ACCESS_FORBIDDEN",
      robotsUrl,
    };
  }

  // Other unsuccessful responses: fail safely.
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      allowed: false,
      reason: "ROBOTS_HTTP_ERROR",
      robotsUrl,
      statusCode: response.statusCode,
    };
  }

  // Parse the robots.txt contents.
  const robots = robotsParser(robotsUrl, response.body);

  // Check permission for our specific crawler and submitted URL.
  const allowed =
    robots.isAllowed(targetUrl.toString(), CRAWLER_USER_AGENT) === true;

  return {
    allowed,
    reason: allowed ? "ALLOWED_BY_ROBOTS_TXT" : "DISALLOWED_BY_ROBOTS_TXT",
    robotsUrl,
    finalRobotsUrl: response.finalUrl,
  };
}
