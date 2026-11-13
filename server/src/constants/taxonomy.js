// Fixed lists for the classification fields.
//
// For these fields the LLM does not copy text: it picks the best-fitting
// value from the list below. That pick is only kept if the LLM's evidence is
// a real excerpt of the page AND contains one of the value's keywords, so
// every mapped value is still traceable to the page. Everything else
// (name, descriptions, features, ...) stays copy-only.
//
// Keyword rules (see keywordPattern in extraction.service.js):
// - matched as whole words, ignoring case, with an optional plural "s"/"es";
// - an ALL-CAPS keyword (CRM, API, HR, ...) must match in capitals, so "HR"
//   is not found inside ordinary words or "it" mistaken for "IT".
// - the value itself also counts as a keyword, unless labelIsKeyword: false.

// labelIsKeyword: false when the label alone is too ambiguous to prove the
// value (e.g. "Cloud" also appears in feature names).
const entry = (value, keywords = [], { labelIsKeyword = true } = {}) => ({
  value,
  keywords,
  labelIsKeyword,
});

export const TAXONOMY = {
  product_kind: [
    entry("Software", ["software", "SoftwareApplication", "WebApplication", "application"]),
    entry("Platform", ["platform"]),
    entry("API", ["API", "SDK", "developer API", "REST API"]),
    entry("Mobile app", ["mobile app", "MobileApplication", "iOS app", "Android app", "App Store", "Google Play"]),
    entry("Browser extension", ["browser extension", "Chrome extension", "Firefox add-on", "Edge extension"]),
    entry("Hardware", ["hardware", "device", "devices"]),
    entry("Managed service", ["managed service", "professional services", "consulting services", "done-for-you"]),
  ],

  category: [
    entry("CRM", ["CRM", "customer relationship management"]),
    entry("Marketing automation", ["marketing automation", "marketing software", "marketing platform", "marketing hub"]),
    entry("Email marketing", ["email marketing", "newsletter", "email campaigns"]),
    entry("Sales engagement", ["sales software", "sales platform", "sales engagement", "sales hub", "sales pipeline"]),
    entry("Customer support", ["customer support", "customer service", "help desk", "helpdesk", "ticketing", "service desk"]),
    entry("Project management", ["project management", "task management", "work management", "project tracking"]),
    entry("Team collaboration", ["collaboration", "collaborate", "team workspace", "whiteboard"]),
    entry("Team communication", ["messaging", "team chat", "video conferencing", "video calls", "channels"]),
    entry("Developer platform", ["developer platform", "code hosting", "repository hosting", "software development", "developers"]),
    entry("DevOps & CI/CD", ["CI/CD", "continuous integration", "continuous delivery", "DevOps", "deployment pipeline"]),
    entry("Application security", ["application security", "code security", "vulnerability", "secret scanning", "AppSec"]),
    entry("Cybersecurity", ["cybersecurity", "security platform", "threat detection", "endpoint security", "zero trust"]),
    entry("Identity & access management", ["identity management", "access management", "single sign-on", "SSO", "IAM"]),
    entry("Analytics & BI", ["analytics", "business intelligence", "BI", "dashboards", "data visualization", "data visualisation"]),
    entry("Data integration", ["data integration", "ETL", "ELT", "data pipeline"]),
    entry("Database", ["database", "SQL", "NoSQL"]),
    entry("Cloud infrastructure", ["cloud infrastructure", "cloud computing", "serverless", "IaaS", "PaaS", "cloud hosting"]),
    entry("Monitoring & observability", ["monitoring", "observability", "APM", "logging", "tracing", "uptime"]),
    entry("AI & machine learning", ["machine learning", "generative AI", "LLM", "artificial intelligence", "AI platform", "AI agent"]),
    entry("Workflow automation", ["workflow automation", "automate workflows", "integration platform", "iPaaS", "no-code automation"]),
    entry("Accounting & finance", ["accounting", "bookkeeping", "invoicing", "expense management", "financial management"]),
    entry("Payments", ["payments", "payment processing", "checkout", "billing"]),
    entry("E-commerce", ["e-commerce", "ecommerce", "online store", "storefront", "shopping cart"]),
    entry("HR & recruiting", ["HR", "human resources", "recruiting", "applicant tracking", "hiring", "talent"]),
    entry("Payroll", ["payroll"]),
    entry("ERP", ["ERP", "enterprise resource planning"]),
    entry("Design", ["design tool", "prototyping", "UI design", "graphic design", "design platform"]),
    entry("Content management", ["CMS", "content management"]),
    entry("Website builder", ["website builder", "site builder", "build a website", "landing page builder"]),
    entry("Forms & surveys", ["form builder", "online forms", "surveys", "questionnaire"]),
    entry("Document management", ["document management", "file sharing", "file storage"]),
    entry("E-signature", ["e-signature", "esignature", "electronic signature", "eSign"]),
    entry("Productivity", ["productivity", "note-taking", "notes", "wiki", "knowledge base"]),
    entry("Scheduling", ["scheduling", "appointment", "booking", "calendar"]),
    entry("Learning management", ["LMS", "learning management", "e-learning", "online courses", "training platform"]),
  ],

  // Only when the page names the industry the product serves.
  industry: [
    entry("Technology", ["technology companies", "tech companies", "software companies", "SaaS companies", "IT teams", "engineering teams"]),
    entry("Healthcare", ["healthcare", "health care", "hospital", "clinic", "patients", "medical", "HIPAA"]),
    entry("Financial services", ["financial services", "banking", "bank", "fintech", "lenders", "credit unions", "wealth management"]),
    entry("Retail & e-commerce", ["retail", "retailer", "e-commerce", "ecommerce", "online store", "merchant"]),
    entry("Education", ["education", "school", "university", "universities", "students", "teachers", "K-12"]),
    entry("Manufacturing", ["manufacturing", "manufacturer", "factory", "factories"]),
    entry("Real estate", ["real estate", "property management", "realtor", "brokerage"]),
    entry("Legal", ["law firm", "lawyer", "attorney", "legal teams"]),
    entry("Government", ["government", "public sector", "municipal", "federal"]),
    entry("Non-profit", ["nonprofit", "non-profit", "charity", "charities", "NGO"]),
    entry("Media & entertainment", ["media companies", "publisher", "publishing", "entertainment", "broadcaster"]),
    entry("Hospitality & travel", ["hospitality", "hotel", "restaurant", "travel"]),
    entry("Logistics & transportation", ["logistics", "freight", "transportation", "fleet", "supply chain"]),
    entry("Construction", ["construction", "contractor"]),
    entry("Energy & utilities", ["energy", "utilities", "oil and gas", "renewables"]),
    entry("Telecommunications", ["telecommunications", "telecom"]),
    entry("Professional services", ["professional services", "agencies", "consultancies", "consulting firm"]),
    entry("Marketing & advertising", ["marketing agencies", "advertising", "advertiser", "ad agencies"]),
    entry("Insurance", ["insurance", "insurer", "insurtech"]),
  ],

  platforms: [
    entry("Web", ["web", "web-based", "web app", "browser", "browser-based"]),
    entry("Windows", ["Windows"]),
    entry("macOS", ["macOS", "Mac", "OS X"]),
    entry("Linux", ["Linux", "Ubuntu"]),
    entry("iOS", ["iOS", "iPhone", "iPad", "App Store"]),
    entry("Android", ["Android", "Google Play"]),
    entry("Browser extension", ["browser extension", "Chrome extension", "Firefox add-on", "Edge extension"]),
  ],

  deployments: [
    // Not bare "cloud" (matches feature names like "Cloud development
    // environments") or "hosted" (matches inside "self-hosted").
    entry("Cloud", ["cloud-based", "cloud-hosted", "cloud software", "in the cloud", "SaaS", "software as a service", "fully hosted", "fully managed"], { labelIsKeyword: false }),
    entry("On-premises", ["on-premises", "on-premise", "on-prem", "on premises"]),
    entry("Self-hosted", ["self-hosted", "self hosted", "self-managed", "host it yourself"]),
    entry("Hybrid", ["hybrid"]),
  ],
};

export const MAPPED_FIELDS = Object.keys(TAXONOMY);

export const allowedValues = (field) => TAXONOMY[field].map((e) => e.value);

// The list entry for a value, ignoring case; null if it is not on the list.
export function findTaxonomyEntry(field, value) {
  const wanted = String(value ?? "").trim().toLowerCase();
  return TAXONOMY[field]?.find((e) => e.value.toLowerCase() === wanted) ?? null;
}
