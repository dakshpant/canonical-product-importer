import http from "node:http";
import https from "node:https";
import net from "node:net";

import { resolvePublicAddress } from "./network-safety.js";

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
          req.destroy(new Error("Response exceeds the 2 MB limit."));
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
      req.destroy(new Error("Request timed out."));
    });

    req.on("error", reject);

    req.end();
  });
}

export async function fetchResource(inputUrl, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error("Too many redirects.");
  }

  const url = new URL(inputUrl);

  const verifiedAddress = await resolvePublicAddress(url.toString());

  if (!verifiedAddress) {
    throw new Error("URL points to a non-public or invalid address.");
  }

  const response = await requestOnce(url, verifiedAddress);

  const redirectStatuses = [301, 302, 303, 307, 308];

  if (redirectStatuses.includes(response.statusCode)) {
    const location = response.headers.location;

    if (!location) {
      throw new Error("Redirect response has no Location header.");
    }

    const redirectUrl = new URL(location, url);

    return fetchResource(redirectUrl.toString(), redirectCount + 1);
  }

  return {
    body: response.body.toString("utf8"),
    finalUrl: url.toString(),
    statusCode: response.statusCode,
    contentType: response.headers["content-type"] || "",
  };
}

export async function fetchPage(inputUrl) {
  const result = await fetchResource(inputUrl);

  if (result.statusCode === 404) {
    throw new Error("Page not found.");
  }

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`Website returned HTTP ${result.statusCode}.`);
  }

  if (!result.contentType.includes("text/html")) {
    throw new Error("URL did not return an HTML page.");
  }

  return {
    html: result.body,
    finalUrl: result.finalUrl,
    statusCode: result.statusCode,
    contentType: result.contentType,
  };
}
