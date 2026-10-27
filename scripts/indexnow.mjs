// Tells Bing (and the other IndexNow engines) to recrawl every URL in the live
// sitemap. ChatGPT search reads Bing's index, so this is how new pages reach it
// quickly. Run after a deploy that adds or changes public pages:
//
//   npm run indexnow
//
// The key is public by design: IndexNow proves ownership by fetching
// public/<key>.txt from the site.

const SITE = "https://salelinx.com";
const KEY = "040fc1fa3a3f40329939d881490f2b0c";

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urlList.length === 0) throw new Error("sitemap.xml has no <loc> entries");

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(SITE).host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList,
  }),
});
console.log(`IndexNow: ${res.status} for ${urlList.length} URLs`);
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
