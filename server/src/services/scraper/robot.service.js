import robotsParser from "robots-parser";
import { fetchResource } from "./scraper.service.js";

const CRAWLER_USER_AGENT = "CanonicalProductImporter";

// robots.txt rarely changes; reuse it for every URL on the same origin.
const ROBOTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const robotsCache = new Map(); // origin -> { expiresAt, rules }

/**
 * Fetch and interpret robots.txt for one origin.
 * Returns one of:
 *   { kind: "rules", robots, robotsUrl, finalRobotsUrl }  -> check per URL
 *   { kind: "allow", reason, robotsUrl, ... }             -> everything allowed
 *   { kind: "deny",  reason, robotsUrl, ... }             -> everything blocked
 *
 * Follows RFC 9309: 4xx means "no restrictions", 5xx and network errors
 * mean "assume full disallow". 401/403 are treated conservatively as deny.
 */
async function loadRobotsRules(origin) {
  const robotsUrl = new URL("/robots.txt", origin).toString();

  let response;

  try {
    response = await fetchResource(robotsUrl);
  } catch (error) {
    // The host itself is unreachable or private: report that, not robots.txt.
    if (error.code === "HOST_NOT_ALLOWED") {
      return { kind: "deny", reason: "HOST_NOT_ALLOWED", robotsUrl, error: error.message };
    }

    return {
      kind: "deny",
      reason: "ROBOTS_FETCH_FAILED",
      robotsUrl,
      error: error.message,
    };
  }

  const { statusCode } = response;

  if (statusCode === 401 || statusCode === 403) {
    return { kind: "deny", reason: "ROBOTS_ACCESS_FORBIDDEN", robotsUrl, statusCode };
  }

  if (statusCode === 404) {
    return { kind: "allow", reason: "ROBOTS_NOT_FOUND", robotsUrl };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return { kind: "allow", reason: "ROBOTS_UNAVAILABLE", robotsUrl, statusCode };
  }

  if (statusCode < 200 || statusCode >= 300) {
    return { kind: "deny", reason: "ROBOTS_HTTP_ERROR", robotsUrl, statusCode };
  }

  return {
    kind: "rules",
    robots: robotsParser(robotsUrl, response.body),
    robotsUrl,
    finalRobotsUrl: response.finalUrl,
  };
}

async function getRobotsRules(origin) {
  const cached = robotsCache.get(origin);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.rules;
  }

  const rules = await loadRobotsRules(origin);

  // Don't keep a temporary failure around for the whole TTL.
  if (!["ROBOTS_FETCH_FAILED", "ROBOTS_HTTP_ERROR", "HOST_NOT_ALLOWED"].includes(rules.reason)) {
    robotsCache.set(origin, { expiresAt: Date.now() + ROBOTS_CACHE_TTL, rules });
  }

  return rules;
}

export function clearRobotsCache() {
  robotsCache.clear();
}

export async function checkRobotsPermission(inputUrl) {
  const targetUrl = new URL(inputUrl);
  const rules = await getRobotsRules(targetUrl.origin);

  if (rules.kind !== "rules") {
    const { kind, ...details } = rules;
    return { allowed: kind === "allow", ...details };
  }

  // Check permission for our specific crawler and submitted URL.
  const allowed =
    rules.robots.isAllowed(targetUrl.toString(), CRAWLER_USER_AGENT) === true;

  return {
    allowed,
    reason: allowed ? "ALLOWED_BY_ROBOTS_TXT" : "DISALLOWED_BY_ROBOTS_TXT",
    robotsUrl: rules.robotsUrl,
    finalRobotsUrl: rules.finalRobotsUrl,
  };
}
