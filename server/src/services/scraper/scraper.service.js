import http from "node:http";
import https from "node:https";
import net from "node:net";

import { resolvePublicAddress } from "./network-safety.js";
import { ScrapeError, SCRAPE_ERROR } from "./scrape-error.js";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2 MB
const REQUEST_TIMEOUT = 15000;

function requestOnce(url, verifiedAddress) {
  return new Promise((resolve, reject) => {
    const hostname = url.hostname.replace(/^\[|\]$/g, "");

    const client = url.protocol === "https:" ? https : http;

    const options = {
      protocol: url.protocol,
      hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",

      headers: {
        "User-Agent": "CanonicalProductImporter/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain,*/*;q=0.8",
        "Accept-Encoding": "identity",
      },

      // Pin the connection to the IP we already verified.
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions?.all) {
          callback(null, [verifiedAddress]);
        } else {
          callback(null, verifiedAddress.address, verifiedAddress.family);
        }
      },

      // Preserve TLS hostname verification for HTTPS domains.
      ...(url.protocol === "https:" && !net.isIP(hostname)
        ? { servername: hostname }
        : {}),
    };

    const req = client.request(options, (res) => {
      const chunks = [];
      let totalSize = 0;

      res.on("data", (chunk) => {
        totalSize += chunk.length;

        if (totalSize > MAX_RESPONSE_SIZE) {
          req.destroy(
            new ScrapeError(
              SCRAPE_ERROR.TOO_LARGE,
              "Response exceeds the 2 MB limit.",
            ),
          );
          return;
        }

        chunks.push(chunk);
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });

      res.on("error", reject);
    });

    req.setTimeout(REQUEST_TIMEOUT, () => {
      req.destroy(
        new ScrapeError(SCRAPE_ERROR.TIMEOUT, "Request timed out."),
      );
    });

    req.on("error", (error) => {
      reject(
        error instanceof ScrapeError
          ? error
          : new ScrapeError(
              SCRAPE_ERROR.FETCH_FAILED,
              `Could not connect: ${error.message}`,
            ),
      );
    });

    req.end();
  });
}

/**
 * Fetch a URL safely, following up to MAX_REDIRECTS redirects.
 * Every hop is re-checked against private network addresses.
 *
 * options.onRedirect(fromUrl, toUrl) is awaited before each redirect is
 * followed; throw from it to stop (used for per-hop robots.txt checks).
 */
export async function fetchResource(inputUrl, options = {}) {
  const { redirectCount = 0, onRedirect } = options;

  if (redirectCount > MAX_REDIRECTS) {
    throw new ScrapeError(SCRAPE_ERROR.TOO_MANY_REDIRECTS, "Too many redirects.");
  }

  const url = new URL(inputUrl);

  const verifiedAddress = await resolvePublicAddress(url.toString());

  if (!verifiedAddress) {
    throw new ScrapeError(
      SCRAPE_ERROR.HOST_NOT_ALLOWED,
      "Could not resolve the host, or it points to a private network address.",
    );
  }

  const response = await requestOnce(url, verifiedAddress);

  const redirectStatuses = [301, 302, 303, 307, 308];

  if (redirectStatuses.includes(response.statusCode)) {
    const location = response.headers.location;

    if (!location) {
      throw new ScrapeError(
        SCRAPE_ERROR.REDIRECT_WITHOUT_LOCATION,
        "Redirect response has no Location header.",
      );
    }

    const redirectUrl = new URL(location, url);

    if (onRedirect) {
      await onRedirect(url.toString(), redirectUrl.toString());
    }

    return fetchResource(redirectUrl.toString(), {
      redirectCount: redirectCount + 1,
      onRedirect,
    });
  }

  return {
    body: response.body.toString("utf8"),
    finalUrl: url.toString(),
    statusCode: response.statusCode,
    contentType: response.headers["content-type"] || "",
  };
}

function httpStatusError(statusCode) {
  if (statusCode === 404 || statusCode === 410) {
    return new ScrapeError(SCRAPE_ERROR.HTTP_404, "Page not found.", { statusCode });
  }

  if (statusCode === 401 || statusCode === 403) {
    return new ScrapeError(
      SCRAPE_ERROR.ACCESS_DENIED,
      `Website refused access (HTTP ${statusCode}).`,
      { statusCode },
    );
  }

  if (statusCode === 429) {
    return new ScrapeError(
      SCRAPE_ERROR.RATE_LIMITED,
      "Website is rate limiting requests (HTTP 429).",
      { statusCode },
    );
  }

  return new ScrapeError(
    SCRAPE_ERROR.HTTP_ERROR,
    `Website returned HTTP ${statusCode}.`,
    { statusCode },
  );
}

export async function fetchPage(inputUrl, options = {}) {
  const result = await fetchResource(inputUrl, options);

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw httpStatusError(result.statusCode);
  }

  const contentType = result.contentType.toLowerCase();

  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new ScrapeError(
      SCRAPE_ERROR.NOT_HTML,
      "URL did not return an HTML page.",
      { contentType: result.contentType },
    );
  }

  return {
    html: result.body,
    finalUrl: result.finalUrl,
    statusCode: result.statusCode,
    contentType: result.contentType,
  };
}
