// Trading API XML in and out, kept free of network and secrets so it can be
// tested against recorded eBay responses: deno test supabase/functions/ebay/

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.5.0';

const ARRAY_PATHS = new Set([
  'GetMyeBaySellingResponse.ActiveList.ItemArray.Item',
  'GetMyeBaySellingResponse.UnsoldList.ItemArray.Item',
  'GetMyeBaySellingResponse.SoldList.OrderTransactionArray.OrderTransaction',
  'GetMyeBaySellingResponse.SoldList.OrderTransactionArray.OrderTransaction.Order.TransactionArray.Transaction',
  'GetItemResponse.Item.PictureDetails.PictureURL',
  'GetItemResponse.Item.ItemSpecifics.NameValueList',
  'GetItemResponse.Item.ItemSpecifics.NameValueList.Value',
]);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  parseTagValue: false,
  isArray: (_name: string, jpath: string) => ARRAY_PATHS.has(jpath) || jpath.endsWith('.Errors'),
});

export class EbayError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

export function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseTrading(call: string, text: string) {
  const body = xml.parse(text)?.[`${call}Response`];
  if (!body) throw new EbayError(`Unexpected eBay response to ${call}`, 'ebay', 502);
  if (body.Ack === 'Failure' || body.Ack === 'PartialFailure') {
    const errors = (body.Errors ?? []).filter((e) => e.SeverityCode === 'Error');
    // 931/932/21916013: the token eBay was given is no longer valid.
    const reauth = errors.some((e) => ['931', '932', '21916013'].includes(String(e.ErrorCode)));
    const message = errors.map((e) => e.LongMessage ?? e.ShortMessage).join(' ') || `${call} failed`;
    throw new EbayError(message, reauth ? 'reauth' : 'ebay');
  }
  return body;
}

const money = (amount) =>
  amount ? { value: Number(amount['#text'] ?? amount), currency: amount['@currencyID'] ?? null } : null;

function summaryFromActive(item) {
  const price = money(item.SellingStatus?.CurrentPrice);
  return {
    itemId: String(item.ItemID),
    title: item.Title ?? '',
    price: price?.value ?? 0,
    currency: price?.currency ?? null,
    quantity: Number(item.QuantityAvailable ?? item.Quantity ?? 1),
    photo: item.PictureDetails?.GalleryURL ?? null,
    url: item.ListingDetails?.ViewItemURL ?? null,
    createdAt: item.ListingDetails?.StartTime ?? null,
    watchCount: item.WatchCount != null ? Number(item.WatchCount) : null,
    status: 'active',
  };
}

function soldTransactions(list) {
  return (list?.OrderTransactionArray?.OrderTransaction ?? []).flatMap(
    (ot) => (ot.Transaction ? [ot.Transaction] : ot.Order?.TransactionArray?.Transaction ?? []),
  );
}

function summaryFromSold(tx) {
  const item = tx.Item ?? {};
  const price = money(tx.TotalTransactionPrice ?? item.SellingStatus?.CurrentPrice);
  return {
    itemId: String(item.ItemID),
    title: item.Title ?? '',
    price: price?.value ?? 0,
    currency: price?.currency ?? null,
    quantity: 0,
    photo: item.PictureDetails?.GalleryURL ?? null,
    url: item.ListingDetails?.ViewItemURL ?? null,
    createdAt: item.ListingDetails?.StartTime ?? null,
    watchCount: null,
    status: 'sold',
  };
}

export function listingsFromResponse(body, page: number) {
  const active = (body.ActiveList?.ItemArray?.Item ?? []).map(summaryFromActive);
  const activeIds = new Set(active.map((l) => l.itemId));
  // A multi-quantity listing can be both selling and partly sold; it stays active.
  const sold = soldTransactions(body.SoldList)
    .map(summaryFromSold)
    .filter((l) => !activeIds.has(l.itemId));
  const taken = new Set([...activeIds, ...sold.map((l) => l.itemId)]);
  // Ended without selling: relistable from eBay's Unsold list, so the panel keeps showing it.
  const unsold = (body.UnsoldList?.ItemArray?.Item ?? [])
    // A relisted item lives on under its new id in the active list.
    .filter((item) => !item.ListingDetails?.RelistedItemID)
    .map((item) => ({ ...summaryFromActive(item), quantity: 0, watchCount: null, status: 'hidden' }))
    .filter((l) => !taken.has(l.itemId));
  const pages = Math.max(
    Number(body.ActiveList?.PaginationResult?.TotalNumberOfPages ?? 0),
    Number(body.SoldList?.PaginationResult?.TotalNumberOfPages ?? 0),
    Number(body.UnsoldList?.PaginationResult?.TotalNumberOfPages ?? 0),
  );
  return { listings: [...sold, ...unsold, ...active], hasMore: page < pages };
}

export function itemFromResponse(body) {
  const it = body.Item;
  const price = money(it.StartPrice ?? it.SellingStatus?.CurrentPrice);
  const quantity = Number(it.Quantity ?? 0) - Number(it.SellingStatus?.QuantitySold ?? 0);
  const specifics: Record<string, string[]> = {};
  for (const nv of it.ItemSpecifics?.NameValueList ?? []) {
    specifics[nv.Name] = (nv.Value ?? []).map(String);
  }
  const listingStatus = it.SellingStatus?.ListingStatus;
  return {
    itemId: String(it.ItemID),
    title: it.Title ?? '',
    description: it.Description ?? '',
    price: price?.value ?? 0,
    currency: price?.currency ?? it.Currency ?? null,
    quantity,
    conditionId: it.ConditionID != null ? Number(it.ConditionID) : null,
    conditionName: it.ConditionDisplayName ?? null,
    conditionDescription: it.ConditionDescription ?? '',
    sku: it.SKU ?? null,
    bestOffer: {
      enabled: String(it.BestOfferDetails?.BestOfferEnabled) === 'true',
      minimum: money(it.ListingDetails?.MinimumBestOfferPrice)?.value ?? null,
      autoAccept: money(it.ListingDetails?.BestOfferAutoAcceptPrice)?.value ?? null,
    },
    dispatchDays: it.DispatchTimeMax != null ? Number(it.DispatchTimeMax) : null,
    postcode: it.PostalCode ?? null,
    location: it.Location ?? null,
    returnsAccepted: it.ReturnPolicy?.ReturnsAcceptedOption ?? null,
    policies: {
      shipping: it.SellerProfiles?.SellerShippingProfile?.ShippingProfileName ?? null,
      returns: it.SellerProfiles?.SellerReturnProfile?.ReturnProfileName ?? null,
      payment: it.SellerProfiles?.SellerPaymentProfile?.PaymentProfileName ?? null,
    },
    photos: (it.PictureDetails?.PictureURL ?? []).map(String),
    specifics,
    categoryId: it.PrimaryCategory?.CategoryID ?? null,
    categoryName: it.PrimaryCategory?.CategoryName ?? null,
    url: it.ListingDetails?.ViewItemURL ?? null,
    createdAt: it.ListingDetails?.StartTime ?? null,
    watchCount: it.WatchCount != null ? Number(it.WatchCount) : null,
    hitCount: it.HitCount != null ? Number(it.HitCount) : null,
    hasVariations: !!it.Variations,
    status:
      listingStatus === 'Active'
        ? 'active'
        : Number(it.SellingStatus?.QuantitySold ?? 0) > 0
          ? 'sold'
          : 'hidden',
  };
}

export function reviseFields(c): string {
  let fields = '';
  if (typeof c.title === 'string') fields += `<Title>${esc(c.title.slice(0, 80))}</Title>`;
  if (typeof c.description === 'string') fields += `<Description>${esc(c.description)}</Description>`;
  if (typeof c.price === 'number') fields += `<StartPrice>${c.price.toFixed(2)}</StartPrice>`;
  // Revise takes the available quantity; eBay adds the units already sold.
  if (Number.isInteger(c.quantity)) fields += `<Quantity>${c.quantity}</Quantity>`;
  if (Number.isInteger(c.conditionId)) fields += `<ConditionID>${c.conditionId}</ConditionID>`;
  if (typeof c.categoryId === 'string' && /^\d+$/.test(c.categoryId)) {
    fields += `<PrimaryCategory><CategoryID>${c.categoryId}</CategoryID></PrimaryCategory>`;
  }
  if (typeof c.conditionDescription === 'string') {
    fields += `<ConditionDescription>${esc(c.conditionDescription.slice(0, 1000))}</ConditionDescription>`;
  }
  if (c.bestOffer && typeof c.bestOffer === 'object') {
    const { enabled, minimum, autoAccept } = c.bestOffer;
    fields += `<BestOfferDetails><BestOfferEnabled>${enabled === true}</BestOfferEnabled></BestOfferDetails>`;
    let prices = '';
    if (enabled === true && typeof autoAccept === 'number') {
      prices += `<BestOfferAutoAcceptPrice>${autoAccept.toFixed(2)}</BestOfferAutoAcceptPrice>`;
    }
    if (enabled === true && typeof minimum === 'number') {
      prices += `<MinimumBestOfferPrice>${minimum.toFixed(2)}</MinimumBestOfferPrice>`;
    }
    if (prices) fields += `<ListingDetails>${prices}</ListingDetails>`;
  }
  // Both of these replace the whole list on eBay, so the caller sends the full set.
  if (Array.isArray(c.photos)) {
    fields += `<PictureDetails>${c.photos.map((u) => `<PictureURL>${esc(u)}</PictureURL>`).join('')}</PictureDetails>`;
  }
  if (c.specifics && typeof c.specifics === 'object') {
    fields +=
      '<ItemSpecifics>' +
      Object.entries(c.specifics)
        .map(
          ([name, values]) =>
            `<NameValueList><Name>${esc(name)}</Name>${[values]
              .flat()
              .map((v) => `<Value>${esc(v)}</Value>`)
              .join('')}</NameValueList>`,
        )
        .join('') +
      '</ItemSpecifics>';
  }
  return fields;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '');

/** Query string for a LISTING traffic report over the 90 days before `now`. */
export function trafficQuery(itemIds: string[], now: Date): string {
  const end = new Date(now.getTime() - 86_400_000);
  const start = new Date(end.getTime() - 89 * 86_400_000);
  return new URLSearchParams({
    dimension: 'LISTING',
    metric: 'LISTING_VIEWS_TOTAL',
    filter: `listing_ids:{${itemIds.join('|')}},date_range:[${ymd(start)}..${ymd(end)}]`,
  }).toString();
}

export function viewsFromTrafficReport(report): Record<string, number> {
  const views: Record<string, number> = {};
  for (const r of report?.records ?? []) {
    const id = r.dimensionValues?.[0]?.value;
    const metric = r.metricValues?.[0];
    if (id == null || metric?.applicable === false || metric?.value == null) continue;
    const n = Number(metric.value);
    if (Number.isFinite(n)) views[String(id)] = n;
  }
  return views;
}

/** Taxonomy item aspects for a category, trimmed to what the editor renders. */
export function aspectsFromResponse(body) {
  return (body?.aspects ?? []).map((a) => ({
    name: a.localizedAspectName,
    required: a.aspectConstraint?.aspectRequired === true,
    recommended: a.aspectConstraint?.aspectUsage === 'RECOMMENDED',
    freeText: a.aspectConstraint?.aspectMode !== 'SELECTION_ONLY',
    multi: a.aspectConstraint?.itemToAspectCardinality === 'MULTI',
    values: (a.aspectValues ?? []).slice(0, 10000).map((v) => v.localizedValue),
  }));
}

export function conditionsFromResponse(body) {
  const policy = body?.itemConditionPolicies?.[0];
  return (policy?.itemConditions ?? []).map((c) => ({
    id: Number(c.conditionId),
    name: c.conditionDescription,
  }));
}

/** Taxonomy category suggestions as leaf id, name and full path. */
export function categorySuggestionsFromResponse(body) {
  return (body?.categorySuggestions ?? []).map((sug) => {
    const ancestors = [...(sug.categoryTreeNodeAncestors ?? [])]
      .sort((a, b) => (b.categoryTreeNodeLevel ?? 0) - (a.categoryTreeNodeLevel ?? 0))
      .map((a) => a.categoryName);
    return {
      id: String(sug.category?.categoryId),
      name: sug.category?.categoryName,
      path: [...ancestors.reverse(), sug.category?.categoryName].join(' > '),
    };
  });
}
