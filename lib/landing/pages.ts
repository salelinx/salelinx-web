export type LandingPage = {
  slug: string;
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  intro: string;
  steps: string[];
  points: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  doc: { label: string; path: string };
  guides?: string[];
};

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: 'crosslist',
    navLabel: 'Depop, Vinted and eBay crosslister',
    metaTitle: 'Crosslist between Depop, Vinted and eBay in one click',
    metaDescription:
      'Copy listings between Depop, Vinted and eBay in any direction, in bulk. Photos, title, price, size, brand and category carried over. Free 14-day trial.',
    title: 'Crosslist between Depop, Vinted and eBay, in any direction',
    intro:
      'SaleLinx copies any listing you already have on Depop, Vinted or eBay to either of the others. Pick the items, click once, and SaleLinx creates them in the background over the marketplace APIs, as drafts on Depop and Vinted or as live eBay listings once you have seen eBay\'s fee. There is no form to fill in and no editor to babysit, and there is no cap on how many you send in one batch.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop and Vinted. For eBay, connect your account once in Settings, with no tab needed.',
      'Open the Crosslist tab and pick where to copy From and To: Depop, Vinted or eBay, in any direction.',
      'Tick the listings you want. Switch the filter to Unlinked to hide anything you have already crosslisted, so nothing is copied twice.',
      'Click Crosslist. Copies to Depop and Vinted are saved as drafts for you to check and post. Copies to eBay are posted as live fixed-price listings, after SaleLinx shows you eBay\'s fee for every item.',
    ],
    points: [
      {
        title: 'Categories, sizes and item specifics mapped for you',
        body: 'Depop, Vinted and eBay use different category trees, size systems and condition labels, and eBay also asks for item specifics. SaleLinx translates each one, fills in the specifics, and converts the price if your shops use different currencies. If eBay would still refuse an item, its row shows a Fill in button for what is missing.',
      },
      {
        title: 'Linked listings stay in sync',
        body: 'Every crosslisted item is linked to its original. For Depop and Vinted pairs, when one sells the Restocker takes the other down, so you never sell the same item twice. eBay pairs are linked but not restocked yet.',
      },
      {
        title: 'Bulk-move a whole shop',
        body: 'Moving an existing catalogue across? Switch the filter to Unlinked, select everything and run it in one pass.',
      },
    ],
    faq: [
      {
        q: 'Can I crosslist from Vinted to Depop, or from eBay to Vinted?',
        a: 'Yes. Pick any marketplace as From and any other as To, and the Swap button flips them, so every direction between Depop, Vinted and eBay uses the same tool.',
      },
      {
        q: 'How does crosslisting to eBay work?',
        a: 'Connect your eBay account once in Settings, and eBay never needs a tab open. eBay has no drafts, so copies go live as fixed-price listings, and SaleLinx shows eBay\'s fee for every item before anything is posted. If eBay needs a detail the original does not have, the row shows a Fill in button.',
      },
      {
        q: 'Will my photos lose quality?',
        a: 'No. The original photo files are uploaded to the other marketplace, not screenshots.',
      },
      {
        q: 'Is there a limit on how many items I can crosslist?',
        a: 'Each plan includes a monthly crosslist allowance, shown on the pricing page. Crosslists into or out of eBay count the same as any other. Within that, there is no limit on batch size.',
      },
    ],
    doc: { label: 'Crosslist guide', path: '/docs/inventory/crosslist' },
    guides: ['crosslist-vinted-to-ebay', 'best-crosslisting-apps-uk', 'depop-vs-vinted-uk'],
  },
  {
    slug: 'vinted-to-ebay',
    navLabel: 'Vinted to eBay crosslister',
    metaTitle: 'Crosslist from Vinted to eBay in bulk',
    metaDescription:
      'Copy your Vinted listings to eBay UK in bulk. Photos, size, brand and condition carried over, eBay category and item specifics filled in, fees shown first.',
    title: 'Crosslist your Vinted listings to eBay',
    intro:
      'Most Vinted sellers could reach more buyers on eBay, but retyping every listing into eBay\'s form takes longer than it is worth. SaleLinx copies the Vinted listings you pick straight to your eBay account. It works out the eBay category, fills in the item specifics eBay asks for, uploads the original photos and shows you eBay\'s fee for every item before anything is posted.',
    steps: [
      'Install the SaleLinx Chrome extension, sign in to Vinted and connect your eBay account once in Settings.',
      'Open the Crosslist tab and set From to Vinted and To to eBay.',
      'Tick the listings you want. The Unlinked filter hides anything already on eBay.',
      'Check the review step, which shows eBay\'s fee and anything eBay would refuse, then click Crosslist. eBay has no drafts, so the copies go live as fixed-price listings.',
    ],
    points: [
      {
        title: 'Item specifics filled in for you',
        body: 'eBay asks for brand, colour, size, department and more. SaleLinx fills them in from the Vinted listing, and a row eBay would still refuse gets a Fill in button for what is missing.',
      },
      {
        title: 'Postage set once',
        body: 'SaleLinx uses your eBay business policies or the postage your eBay listings share. If there is nothing to go on, it asks once for your postage, returns and item postcode and remembers them.',
      },
      {
        title: 'Works the other way too',
        body: 'Pick eBay as From and Vinted as To to bring eBay stock onto Vinted. Copies to Vinted are saved as drafts for you to check and post.',
      },
    ],
    faq: [
      {
        q: 'Does eBay need a tab open?',
        a: 'No. eBay connects through eBay\'s own sign-in, so only Vinted needs a tab open while SaleLinx reads your listings.',
      },
      {
        q: 'Will eBay charge me for the listings?',
        a: 'That depends on your eBay account. Private sellers in the UK get free listings and pay no selling fee; business sellers pay eBay\'s fees. SaleLinx shows the fee eBay quotes for each item before you post.',
      },
      {
        q: 'Does SaleLinx see my eBay password?',
        a: 'No. You sign in on eBay\'s own page and can remove SaleLinx\'s access from your eBay account at any time.',
      },
    ],
    doc: { label: 'Crosslist guide', path: '/docs/inventory/crosslist' },
    guides: ['crosslist-vinted-to-ebay', 'ebay-item-specifics', 'ebay-fees-uk'],
  },
  {
    slug: 'depop-to-ebay',
    navLabel: 'Depop to eBay crosslister',
    metaTitle: 'Crosslist from Depop to eBay in bulk',
    metaDescription:
      'Move your Depop shop onto eBay UK without retyping it. SaleLinx maps the category, fills eBay item specifics, uploads the photos and shows eBay fees first.',
    title: 'Crosslist your Depop listings to eBay',
    intro:
      'Depop and eBay describe the same item in different ways: Depop puts the title in the first line of the description and uses its own categories and sizes, while eBay wants a title, an eBay category and a list of item specifics. SaleLinx translates between the two, so you can put your Depop shop on eBay in one pass instead of relisting it by hand.',
    steps: [
      'Install the SaleLinx Chrome extension, sign in to Depop and connect your eBay account once in Settings.',
      'Open the Crosslist tab and set From to Depop and To to eBay.',
      'Tick the listings you want, or switch the filter to Unlinked and select the whole shop.',
      'Check eBay\'s fee for each item in the review step, then click Crosslist. The copies go live on eBay as fixed-price listings.',
    ],
    points: [
      {
        title: 'Depop categories mapped to eBay\'s',
        body: 'SaleLinx picks the eBay category from the title and the Depop category, and carries the size, brand, condition and colour across as eBay item specifics.',
      },
      {
        title: 'Original photos',
        body: 'The original photo files are uploaded to eBay, not screenshots, so nothing loses quality.',
      },
      {
        title: 'Every copy linked',
        body: 'Each eBay copy is linked to its Depop original, so the Unlinked filter always shows what is still left to move.',
      },
    ],
    faq: [
      {
        q: 'Can I crosslist from eBay to Depop instead?',
        a: 'Yes. Swap From and To. Copies to Depop are saved as drafts for you to check and post.',
      },
      {
        q: 'What if eBay needs a detail my Depop listing does not have?',
        a: 'The review step flags the item before anything is posted, and its Fill in button lets you add the missing detail, usually a size or department.',
      },
      {
        q: 'How many items can I crosslist?',
        a: 'Each plan includes a monthly crosslist allowance, shown on the pricing page, and there is no limit on batch size within it.',
      },
    ],
    doc: { label: 'Crosslist guide', path: '/docs/inventory/crosslist' },
    guides: ['ebay-item-specifics', 'ebay-fees-uk', 'depop-vs-vinted-uk'],
  },
  {
    slug: 'ebay-bulk-edit',
    navLabel: 'eBay bulk editor',
    metaTitle: 'Bulk edit eBay listings: prices, titles and photos',
    metaDescription:
      'Edit many eBay listings at once. Change prices by an amount or a percent, rewrite titles and descriptions, swap photos, and end or relist in one save.',
    title: 'Bulk edit your eBay listings',
    intro:
      'eBay\'s own editor opens one listing at a time. SaleLinx loads your eBay listings into one grid next to your Depop and Vinted stock, so you can select a batch, change them together and send every change to eBay in one save.',
    steps: [
      'Install the SaleLinx Chrome extension and connect your eBay account once in Settings.',
      'Open My Listings and filter to eBay. Your active listings, and those sold or ended in the last 60 days, are listed.',
      'Select the listings and click Edit. Change each card by hand, or open Bulk Edit to apply one change to all of them.',
      'Click Save Changes. The edits are sent straight to eBay.',
    ],
    points: [
      {
        title: 'Price changes by amount or percent',
        body: 'Set a new price, or raise or lower prices by a fixed amount or a percentage across the whole selection.',
      },
      {
        title: 'Every field on one card',
        body: 'Each eBay card has the title, description, price, quantity, photos, category, condition, item specifics and offer settings.',
      },
      {
        title: 'End and relist from the same editor',
        body: 'Unlist ends an active listing, and an ended listing can be put back on sale with Relist.',
      },
    ],
    faq: [
      {
        q: 'Can I set a minimum offer on eBay listings?',
        a: 'Yes. Each card has Allow offers with a Minimum offer, and business sellers can also set an auto-accept price.',
      },
      {
        q: 'Does it show what the buyer pays?',
        a: 'For private sellers on eBay UK, each card shows a Buyer will pay figure with eBay\'s Buyer Protection fee added.',
      },
      {
        q: 'How often does SaleLinx check eBay for changes?',
        a: 'At most every 15 minutes. The eBay refresh button fetches your listings straight away.',
      },
    ],
    doc: { label: 'My Listings guide', path: '/docs/inventory/listings' },
    guides: ['ebay-item-specifics', 'ebay-fees-uk'],
  },
  {
    slug: 'depop-auto-refresh',
    navLabel: 'Depop auto refresh',
    metaTitle: 'Depop auto refresh: bump your listings to the top',
    metaDescription:
      'Refresh your Depop listings automatically so they re-enter the newest feed. Same price, photos and words, shop order kept. Runs on a schedule.',
    title: 'Refresh your Depop listings automatically',
    intro:
      'Depop shows newer listings first. SaleLinx re-saves your listings exactly as they are, which moves each one back to the top of the feed without changing the price, photos or wording. Run it by hand on a few items, or schedule a full shop refresh every 4 to 24 hours in the background.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop.',
      'Open the Refresh tab and tick the listings you want to bump, or select all.',
      'Click Refresh, or switch on the scheduler and pick how often it runs.',
    ],
    points: [
      {
        title: 'Nothing changes for the buyer',
        body: 'The listing is saved back with the exact same details. Only its timestamp moves, which is what Depop uses to rank fresh content.',
      },
      {
        title: 'Your shop order is kept',
        body: 'A naive refresh flips your shop upside down. SaleLinx refreshes in reverse, so the order you arranged is the order buyers see.',
      },
      {
        title: 'Paced like a person',
        body: 'Each refresh has a short randomised pause, so the activity looks like you editing through the website.',
      },
    ],
    faq: [
      {
        q: 'How often should I refresh my Depop shop?',
        a: 'Most sellers run a full refresh once or twice a day. The scheduler lets you choose anything from every 4 hours to every 24 hours.',
      },
      {
        q: 'Does refreshing work on Vinted?',
        a: 'Vinted has no equivalent bump, so for Vinted use Relist or Price Drops, which both put an item back in front of buyers.',
      },
    ],
    doc: { label: 'Refresh guide', path: '/docs/inventory/refresh' },
    guides: ['best-time-to-post-on-vinted', 'depop-vs-vinted-uk'],
  },
  {
    slug: 'relist-depop-vinted',
    navLabel: 'Bulk relist tool',
    metaTitle: 'Bulk relist on Depop and Vinted',
    metaDescription:
      'Relist stale Depop and Vinted items as brand-new listings in bulk. Photos are subtly adjusted to avoid duplicate flags, and the original is removed for you.',
    title: 'Bulk relist your Depop and Vinted listings',
    intro:
      'When a listing has gone stale, a fresh copy gets far more views than the original. SaleLinx posts a brand-new listing with the same details, then deletes the old one, so the item re-enters search as new stock. You can relist one item or a whole page at once.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop or Vinted.',
      'Open the Relist tab and select the listings that have gone quiet.',
      'Click Relist. SaleLinx posts each new copy first and only removes the original once the new one is live.',
    ],
    points: [
      {
        title: 'Avoids duplicate detection',
        body: 'Marketplaces spot reused photos. SaleLinx trims, nudges the colour balance and reorders photos just enough to read as new, without changing how they look.',
      },
      {
        title: 'Safe order of operations',
        body: 'Post first, delete second. If anything fails part way, your original listing is still live.',
      },
      {
        title: 'Works on Depop and Vinted',
        body: 'One tool relists on either marketplace, from the same panel.',
      },
    ],
    faq: [
      {
        q: 'Is relisting better than refreshing?',
        a: 'Refreshing is lighter and suits items that are still getting views. Relisting suits items that have gone completely quiet.',
      },
      {
        q: 'Do I lose my likes when I relist?',
        a: 'Yes. A relist is a new listing, so likes and views on the old one do not carry over.',
      },
    ],
    doc: { label: 'Relist guide', path: '/docs/inventory/relist' },
    guides: ['how-to-relist-on-vinted', 'vinted-bump-cost-and-does-it-work'],
  },
  {
    slug: 'depop-vinted-follow-bot',
    navLabel: 'Follow bot',
    metaTitle: 'Depop and Vinted follow bot',
    metaDescription:
      'Grow your Depop and Vinted audience: follow the followers of shops in your niche, your buyers and reviewers, and bulk unfollow, all from one tab.',
    title: 'A follow bot for Depop and Vinted',
    intro:
      'Every follow sends a notification, and notifications bring people to your shop. SaleLinx follows the right accounts for you, such as the followers of a shop in your niche, and lets you bulk unfollow later. It works on Depop and Vinted from the same tab.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop or Vinted.',
      'Open the Bots tab and enter a target shop, or start from their profile page.',
      'Choose Followers or Following and start the run. Progress shows live in the panel.',
    ],
    points: [
      {
        title: 'Target buyers who already shop your style',
        body: 'Following the audience of a similar shop puts you in front of people who already buy what you sell.',
      },
      {
        title: 'Follow your own buyers and reviewers',
        body: 'On Depop, follow everyone who has bought from you or reviewed you, to stay in their feed for repeat sales.',
      },
      {
        title: 'Bulk unfollow and blacklist',
        body: 'Clear your following list in one go, and keep a blacklist of accounts the bot should never target.',
      },
    ],
    faq: [
      {
        q: 'Does the follow bot work on Vinted?',
        a: 'Yes. Following a target shop\'s followers or following, and bulk unfollow, work on both. Buyer, reviewer and liker targeting are Depop only.',
      },
      {
        q: 'How many accounts can I follow per day?',
        a: 'Each plan has a daily follow allowance, shown on the pricing page.',
      },
    ],
    doc: { label: 'Bots guide', path: '/docs/inventory/bots' },
  },
  {
    slug: 'auto-accept-offers',
    navLabel: 'Auto accept offers',
    metaTitle: 'Auto accept offers on Depop and Vinted',
    metaDescription:
      'Accept Depop and Vinted offers automatically when they clear your minimum percent and price. Scans every 5 to 60 minutes, so no buyer is left waiting.',
    title: 'Auto accept offers on Depop and Vinted',
    intro:
      'A buyer who waits hours for a reply often buys elsewhere. SaleLinx checks your pending offers on a schedule and accepts any that meet your rules, so good offers turn into sales straight away and you only handle the ones that need a counter.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop and Vinted.',
      'Open the Offers tab and switch on Auto-accept.',
      'Set a minimum percent of asking price, an optional minimum price, the marketplaces and how often to check.',
    ],
    points: [
      {
        title: 'Two rules, both must pass',
        body: 'An offer is accepted only if it is at least your minimum percent of the listed price and at or above your price floor.',
      },
      {
        title: 'Checks as often as you like',
        body: 'Pick every 5, 10, 15, 30 or 60 minutes. Switching it on runs a check straight away.',
      },
      {
        title: 'See every decision',
        body: 'The panel shows the last run, the next run and the most recent offers it accepted.',
      },
    ],
    faq: [
      {
        q: 'Will it accept low offers?',
        a: 'No. Anything below your minimum percent or price floor is left for you to answer by hand.',
      },
      {
        q: 'Can I use different rules for Depop and Vinted?',
        a: 'Each marketplace runs independently, and you can save presets for the settings you use most.',
      },
    ],
    doc: { label: 'Auto-accept guide', path: '/docs/automate/auto-offers' },
    guides: ['how-to-send-offers-ebay-vinted-depop', 'how-to-price-second-hand-clothes'],
  },
  {
    slug: 'automatic-price-drops',
    navLabel: 'Automatic price drops',
    metaTitle: 'Automatic price drops for Depop and Vinted',
    metaDescription:
      'Schedule markdowns on slow Depop and Vinted stock. Set a percent per cycle, an interval and a minimum price, and SaleLinx lowers prices for you.',
    title: 'Automatic price drops for Depop and Vinted',
    intro:
      'Slow stock needs a nudge, and every price change puts a listing back in front of buyers. SaleLinx lowers prices on the items you choose, on a schedule you set, and never goes below the floor you pick.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop and Vinted.',
      'Open the Price Drops tab and add the listings you want to track.',
      'Set the percent per drop, the days between drops and an optional minimum price, then switch it on.',
    ],
    points: [
      {
        title: 'Predictable markdowns',
        body: 'Each drop is a percentage of the original price, so a 30 pound item at 10 percent drops by 3 pounds every cycle.',
      },
      {
        title: 'A hard price floor',
        body: 'Set a minimum price per item and drops stop there.',
      },
      {
        title: 'Skips what has sold',
        body: 'Sold and hidden items are skipped automatically on every run.',
      },
    ],
    faq: [
      {
        q: 'Does a price drop change anything else on the listing?',
        a: 'No. Only the price changes. Title, photos and description stay exactly as they are.',
      },
    ],
    doc: { label: 'Price Drops guide', path: '/docs/automate/price-drops' },
    guides: ['how-to-price-second-hand-clothes', 'vinted-bump-cost-and-does-it-work'],
  },
  {
    slug: 'print-shipping-labels',
    navLabel: 'Bulk print shipping labels',
    metaTitle: 'Bulk print Depop and Vinted shipping labels',
    metaDescription:
      'Download every Depop and Vinted shipping label as one merged PDF. Filter by carrier, crop Evri labels, and print the whole day\'s orders at once.',
    title: 'Bulk print your Depop and Vinted shipping labels',
    intro:
      'Saving labels one order at a time is slow. SaleLinx gathers your sold orders from Depop and Vinted in one list, then downloads and merges the labels you pick into a single PDF ready to print or email.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop and Vinted.',
      'Open the Labels tab. Your Depop and Vinted orders to ship appear together.',
      'Select the orders, or tick the header box for all of them, and click Print labels.',
    ],
    points: [
      {
        title: 'One PDF for the whole day',
        body: 'Labels are merged in the order shown, saved to your downloads and opened ready to print.',
      },
      {
        title: 'Filter by carrier',
        body: 'Each carrier shows how many orders are waiting, so you can pull up just the Evri pile before a drop-off run.',
      },
      {
        title: 'No wasted paper',
        body: 'Vinted\'s A4 Evri labels are cropped to the label itself before merging.',
      },
    ],
    faq: [
      {
        q: 'Can I email the labels to myself?',
        a: 'Yes. Select the orders and click Email to receive the merged PDF, handy for printing from another device.',
      },
    ],
    doc: { label: 'Labels guide', path: '/docs/buyers/labels' },
    guides: ['vinted-parcel-lost-or-damaged', 'vinted-fees-uk'],
  },
];

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
