# Results report

> **Status: not run yet.** This file sets out how the measurements will be taken and reported. Every number below will come from a real run; nothing has been estimated.

## Method

1. **Baseline.** Fill 2 products by hand from the vendor page, timing from opening the page to the last field filled.
2. **Ground truth.** Write down the correct values for at least 3 products (in `docs/ground-truth/`).
3. **Run.** Import all 8 URLs in one batch through the app, using model `openai/gpt-oss-120b` at temperature 0.
4. **Score.** For each filled field: **correct** (matches the ground truth), **partly correct** (right, but incomplete or extra text) or **wrong**. Admin-only and generated fields are not counted.
5. **Admin time after.** Time the review of each product: from opening the review screen to approve or reject, including edits.

Fields the app can fill: 19 of the 25 canonical fields (`name`, `product_kind`, `category`, `industry`, `sub_category`, `tagline`, `short_description`, `overview`, `website`, `image_url`, `image_alt`, `image_type`, `image_source_page`, `tags`, `skills`, `features`, `deployments`, `platforms`, `target_customers`). `slug` and `sku_id` are generated, `sources` is always written, and the three quantity fields belong to the admin.

## Test set

| # | Product | URL | Why included |
| --- | --- | --- | --- |
| 1 | | | Rich page with JSON-LD |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | **Thin content** |
| 8 | | | **Expected to fail** (e.g. blocked by robots.txt or JavaScript-only) |

## Results

### Per product

| # | Status | Fields filled (of 19) | Left for admin | Dropped by verifier | Accuracy vs ground truth | Admin time |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |

### Summary

| Measure | Before (manual) | After (app) |
| --- | --- | --- |
| Fields filled automatically per product (average) | 0 | |
| Accuracy of filled fields (ground-truth products) | — | |
| Fields left for manual attention per product (average) | 25 | |
| Admin time per product | | |

## Failures and their causes

| URL | Error code | Message | What the admin sees | What would fix it |
| --- | --- | --- | --- | --- |
| | | | | |

## Sample output

_A full `extracted_data` object for one product (product, sources, review.discarded) goes here._

## Error log

_Server log lines for the failed URLs go here._

## Reproducing

```bash
cd server
node src/run-import-batch.js <url1> <url2> ...
```
