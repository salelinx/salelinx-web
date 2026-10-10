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
};

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: 'crosslist-depop-vinted',
    navLabel: 'Depop to Vinted crosslister',
    metaTitle: 'Crosslist Depop to Vinted (and back) in one click',
    metaDescription:
      'Copy your Depop listings to Vinted, or Vinted to Depop, in bulk. Photos, title, price, size, brand and category carried over. Free 14-day trial.',
    title: 'Crosslist from Depop to Vinted, and Vinted to Depop',
    intro:
      'SaleLinx copies any listing you already have on one marketplace to the other. Pick the items, click once, and the queue posts them in the background over the marketplace APIs. There is no form to fill in and no editor to babysit, and there is no cap on how many you send in one batch.',
    steps: [
      'Install the SaleLinx Chrome extension and sign in to Depop and Vinted.',
      'Open the Crosslist tab and choose the direction: Depop to Vinted or Vinted to Depop.',
      'Tick the listings you want. The grid shows only unlinked items by default, so nothing is copied twice.',
      'Click Crosslist. Items are created as drafts for you to check, or published live if you turn on auto-post.',
    ],
    points: [
      {
        title: 'Categories and sizes mapped for you',
        body: 'Depop and Vinted use different category trees, size systems and condition labels. SaleLinx translates each one, so a listing lands in the right place on the other side.',
      },
      {
        title: 'Linked listings stay in sync',
        body: 'Every crosslisted item is linked to its partner. When one sells, SaleLinx can take the other down so you never sell the same item twice.',
      },
      {
        title: 'Bulk-move a whole shop',
        body: 'Moving an existing catalogue across? Switch the filter to Unlinked, select everything and run it in one pass.',
      },
    ],
    faq: [
      {
        q: 'Can I crosslist from Vinted to Depop as well?',
        a: 'Yes. The direction toggle flips the transfer, so both directions use the same tool.',
      },
      {
        q: 'Will my photos lose quality?',
        a: 'No. The original photo files are uploaded to the other marketplace, not screenshots.',
      },
      {
        q: 'Is there a limit on how many items I can crosslist?',
        a: 'Each plan includes a monthly crosslist allowance, shown on the pricing page. Within that, there is no limit on batch size.',
      },
    ],
    doc: { label: 'Crosslist guide', path: '/docs/inventory/crosslist' },
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
        title: 'Works on both marketplaces',
        body: 'The same tool relists on Depop and on Vinted, from one panel.',
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
  },
  {
    slug: 'depop-vinted-follow-bot',
    navLabel: 'Follow bot',
    metaTitle: 'Depop and Vinted follow bot',
    metaDescription:
      'Grow your Depop and Vinted audience: follow the followers of shops in your niche, your buyers and reviewers, and bulk unfollow. One tab for both marketplaces.',
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
    doc: { label: 'Auto-Offers guide', path: '/docs/automate/auto-offers' },
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
      'Open the Labels tab. Your orders to ship from both marketplaces appear together.',
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
  },
];

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
