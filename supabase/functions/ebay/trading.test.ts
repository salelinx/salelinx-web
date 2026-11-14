// deno test supabase/functions/ebay/
// Fixtures follow the response shapes in eBay's Trading API reference.

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  EbayError,
  itemFromResponse,
  listingsFromResponse,
  parseTrading,
  reviseFields,
  trafficQuery,
  viewsFromTrafficReport,
  aspectsFromResponse,
  categorySuggestionsFromResponse,
  addItemXml,
  policiesFromPreferences,
  shippingFromItemXml,
  postageXml,
  shippingServicesFromDetails,
  postageFromItem,
  verifyFromResponse,
  linkSiteId,
  listingCall,
  bestOffersFromResponse,
  respondOfferXml,
  openOrdersFromResponse,
  markShippedXml,
} from './trading.ts';

const SELLING = `<?xml version="1.0" encoding="UTF-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ActiveList>
    <ItemArray>
      <Item>
        <ItemID>110551234567</ItemID>
        <ListingDetails>
          <StartTime>2026-09-01T10:00:00.000Z</StartTime>
          <ViewItemURL>https://www.ebay.co.uk/itm/110551234567</ViewItemURL>
        </ListingDetails>
        <Quantity>3</Quantity>
        <QuantityAvailable>2</QuantityAvailable>
        <SellingStatus><CurrentPrice currencyID="GBP">28.0</CurrentPrice></SellingStatus>
        <Title>Levi's 501 Jeans W32 &amp; L32</Title>
        <WatchCount>4</WatchCount>
        <PictureDetails><GalleryURL>https://i.ebayimg.com/a.jpg</GalleryURL></PictureDetails>
      </Item>
    </ItemArray>
    <PaginationResult><TotalNumberOfPages>2</TotalNumberOfPages></PaginationResult>
  </ActiveList>
  <SoldList>
    <OrderTransactionArray>
      <OrderTransaction>
        <Transaction>
          <Item><ItemID>110551234567</ItemID><Title>Levi's 501 Jeans W32 &amp; L32</Title></Item>
          <TotalTransactionPrice currencyID="GBP">28.0</TotalTransactionPrice>
        </Transaction>
      </OrderTransaction>
      <OrderTransaction>
        <Order>
          <TransactionArray>
            <Transaction>
              <Item>
                <ItemID>110559999999</ItemID>
                <Title>Nike Air Max 90</Title>
                <ListingDetails><ViewItemURL>https://www.ebay.co.uk/itm/110559999999</ViewItemURL></ListingDetails>
              </Item>
              <TotalTransactionPrice currencyID="GBP">65.0</TotalTransactionPrice>
            </Transaction>
          </TransactionArray>
        </Order>
      </OrderTransaction>
    </OrderTransactionArray>
    <PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult>
  </SoldList>
</GetMyeBaySellingResponse>`;

const ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Warning</Ack>
  <Errors><ErrorCode>21917</ErrorCode><SeverityCode>Warning</SeverityCode></Errors>
  <Item>
    <ItemID>110551234567</ItemID>
    <Title>Levi's 501 Jeans W32 &amp; L32</Title>
    <Description>&lt;p&gt;Great jeans&lt;/p&gt;</Description>
    <StartPrice currencyID="GBP">28.0</StartPrice>
    <Quantity>3</Quantity>
    <SellingStatus>
      <CurrentPrice currencyID="GBP">28.0</CurrentPrice>
      <QuantitySold>1</QuantitySold>
      <ListingStatus>Active</ListingStatus>
    </SellingStatus>
    <ConditionID>3000</ConditionID>
    <ConditionDisplayName>Pre-owned</ConditionDisplayName>
    <PictureDetails><PictureURL>https://i.ebayimg.com/1.jpg</PictureURL></PictureDetails>
    <ItemSpecifics>
      <NameValueList><Name>Brand</Name><Value>Levi's</Value></NameValueList>
      <NameValueList><Name>Colour</Name><Value>Blue</Value><Value>Black</Value></NameValueList>
    </ItemSpecifics>
    <PrimaryCategory><CategoryID>11483</CategoryID><CategoryName>Jeans</CategoryName></PrimaryCategory>
    <ListingDetails><StartTime>2026-09-01T10:00:00.000Z</StartTime></ListingDetails>
    <WatchCount>4</WatchCount>
    <HitCount>51</HitCount>
  </Item>
</GetItemResponse>`;

const EXPIRED = `<?xml version="1.0" encoding="UTF-8"?>
<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Failure</Ack>
  <Errors>
    <ShortMessage>Auth token is invalid.</ShortMessage>
    <LongMessage>Validation of the authentication token in API request failed.</LongMessage>
    <ErrorCode>931</ErrorCode>
    <SeverityCode>Error</SeverityCode>
  </Errors>
</GetItemResponse>`;

Deno.test('listings: active rows, sold rows, part-sold stays active, paging', () => {
  const { listings, hasMore } = listingsFromResponse(
    parseTrading('GetMyeBaySelling', SELLING),
    1,
  );
  assertEquals(hasMore, true);
  assertEquals(listings.length, 2);
  const [sold, active] = listings;
  assertEquals(active.itemId, '110551234567');
  assertEquals(active.status, 'active');
  assertEquals(active.title, "Levi's 501 Jeans W32 & L32");
  assertEquals(active.price, 28);
  assertEquals(active.currency, 'GBP');
  assertEquals(active.quantity, 2);
  assertEquals(active.watchCount, 4);
  assertEquals(sold.itemId, '110559999999');
  assertEquals(sold.status, 'sold');
  assertEquals(sold.price, 65);
});

Deno.test('item: warnings pass, single photo and value stay arrays, quantity is what is left', () => {
  const item = itemFromResponse(parseTrading('GetItem', ITEM));
  assertEquals(item.description, '<p>Great jeans</p>');
  assertEquals(item.quantity, 2);
  assertEquals(item.photos, ['https://i.ebayimg.com/1.jpg']);
  assertEquals(item.specifics, { Brand: ["Levi's"], Colour: ['Blue', 'Black'] });
  assertEquals(item.status, 'active');
  assertEquals(item.conditionId, 3000);
  assertEquals(item.hitCount, 51);
});

Deno.test('an expired token is reauth, not a generic failure', () => {
  const err = assertThrows(() => parseTrading('GetItem', EXPIRED), EbayError);
  assertEquals(err.code, 'reauth');
  assertEquals(err.message, 'Validation of the authentication token in API request failed.');
});

Deno.test('the daily call limit is quota, with a message the seller can act on', () => {
  const limited = EXPIRED.replace('<ErrorCode>931</ErrorCode>', '<ErrorCode>518</ErrorCode>');
  const err = assertThrows(() => parseTrading('GetItem', limited), EbayError);
  assertEquals(err.code, 'quota');
  assertEquals(err.status, 429);
});

Deno.test('revise escapes text and sends only what changed', () => {
  assertEquals(reviseFields({}), '');
  assertEquals(
    reviseFields({ title: 'Tom & Jerry <tee>', price: 12.5, quantity: 2 }),
    '<Title>Tom &amp; Jerry &lt;tee&gt;</Title><StartPrice>12.50</StartPrice><Quantity>2</Quantity>',
  );
  assertEquals(
    reviseFields({ photos: ['https://i.ebayimg.com/1.jpg?a=1&b=2'] }),
    '<PictureDetails><PictureURL>https://i.ebayimg.com/1.jpg?a=1&amp;b=2</PictureURL></PictureDetails>',
  );
});

Deno.test('traffic: 90 days ending yesterday, listing ids piped, views keyed by id', () => {
  const q = new URLSearchParams(trafficQuery(['111', '222'], new Date('2026-10-11T12:00:00Z')));
  assertEquals(q.get('dimension'), 'LISTING');
  assertEquals(q.get('filter'), 'listing_ids:{111|222},date_range:[20260713..20261010]');
  assertEquals(
    viewsFromTrafficReport({
      records: [
        { dimensionValues: [{ value: '111' }], metricValues: [{ value: 42, applicable: true }] },
        { dimensionValues: [{ value: '222' }], metricValues: [{ value: null, applicable: false }] },
      ],
    }),
    { '111': 42 },
  );
});

Deno.test('revise sends offers and condition text', () => {
  assertEquals(
    reviseFields({ conditionDescription: 'Small mark', bestOffer: { enabled: true, minimum: 20, autoAccept: 35 } }),
    '<ConditionDescription>Small mark</ConditionDescription>' +
      '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>' +
      '<ListingDetails><BestOfferAutoAcceptPrice>35.00</BestOfferAutoAcceptPrice><MinimumBestOfferPrice>20.00</MinimumBestOfferPrice></ListingDetails>',
  );
  assertEquals(
    reviseFields({ bestOffer: { enabled: false, minimum: 20 } }),
    '<BestOfferDetails><BestOfferEnabled>false</BestOfferEnabled></BestOfferDetails>',
  );
});

Deno.test('aspects keep required/recommended/free-text flags and values', () => {
  const [brand] = aspectsFromResponse({
    aspects: [
      {
        localizedAspectName: 'Brand',
        aspectConstraint: { aspectRequired: true, aspectMode: 'FREE_TEXT', itemToAspectCardinality: 'SINGLE', aspectUsage: 'RECOMMENDED' },
        aspectValues: [{ localizedValue: 'Oakley' }, { localizedValue: 'Nike' }],
      },
    ],
  });
  assertEquals(brand, { name: 'Brand', required: true, recommended: true, freeText: true, multi: false, values: ['Oakley', 'Nike'] });
});

Deno.test('category suggestions read as a root-to-leaf path', () => {
  assertEquals(
    categorySuggestionsFromResponse({
      categorySuggestions: [
        {
          category: { categoryId: '169291', categoryName: 'Bags' },
          categoryTreeNodeAncestors: [
            { categoryName: "Men's Accessories", categoryTreeNodeLevel: 3 },
            { categoryName: 'Men', categoryTreeNodeLevel: 2 },
            { categoryName: 'Clothes, Shoes & Accessories', categoryTreeNodeLevel: 1 },
          ],
        },
      ],
    }),
    [{ id: '169291', name: 'Bags', path: "Clothes, Shoes & Accessories > Men > Men's Accessories > Bags" }],
  );
  assertEquals(reviseFields({ categoryId: '169291' }), '<PrimaryCategory><CategoryID>169291</CategoryID></PrimaryCategory>');
});

Deno.test('ended unsold listings come back as hidden, unless also active or sold', () => {
  const item = (id: string) => ({ ItemID: id, Title: 't', SellingStatus: { CurrentPrice: '5.00' } });
  const { listings } = listingsFromResponse(
    {
      ActiveList: { ItemArray: { Item: [item('1')] } },
      UnsoldList: { ItemArray: { Item: [item('1'), item('2')] } },
    },
    1,
  );
  assertEquals(listings.map((l) => [l.itemId, l.status]), [['2', 'hidden'], ['1', 'active']]);
});

Deno.test('an auction carries its bids, time left and prices; fixed price carries nothing', () => {
  const item = (id: string, extra: Record<string, unknown>) => ({
    ItemID: id,
    Title: 't',
    SellingStatus: { CurrentPrice: { '#text': '12.50', '@currencyID': 'GBP' } },
    ...extra,
  });
  const { listings } = listingsFromResponse(
    {
      ActiveList: {
        ItemArray: {
          Item: [
            item('1', {
              ListingType: 'Chinese',
              TimeLeft: 'P2DT4H',
              StartPrice: { '#text': '5.00', '@currencyID': 'GBP' },
              BuyItNowPrice: { '#text': '30.00', '@currencyID': 'GBP' },
              SellingStatus: {
                CurrentPrice: { '#text': '12.50', '@currencyID': 'GBP' },
                BidCount: 3,
              },
            }),
            item('2', {
              ListingType: 'Chinese',
              BuyItNowPrice: { '#text': '0.0', '@currencyID': 'GBP' },
            }),
            item('3', { ListingType: 'FixedPriceItem', BuyItNowPrice: { '#text': '9.00' } }),
            item('4', {}),
          ],
        },
      },
    },
    1,
  );
  const byId = Object.fromEntries(listings.map((l) => [l.itemId, l]));
  assertEquals(byId['1'].price, 12.5);
  assertEquals(byId['1'].auction, { bids: 3, timeLeft: 'P2DT4H', startPrice: 5, buyItNow: 30 });
  // eBay sends a Buy It Now of 0.0 on an auction without one.
  assertEquals(byId['2'].auction, { bids: 0, timeLeft: null, startPrice: null, buyItNow: null });
  assertEquals(byId['3'].auction, undefined);
  assertEquals(byId['4'].auction, undefined);
});

Deno.test('an ended auction in the Unsold list is still an auction', () => {
  const { listings } = listingsFromResponse(
    {
      UnsoldList: {
        ItemArray: {
          Item: [
            { ItemID: '1', Title: 't', ListingType: 'Chinese', SellingStatus: { CurrentPrice: '5.00' } },
          ],
        },
      },
    },
    1,
  );
  assertEquals(listings[0].status, 'hidden');
  assertEquals(listings[0].auction?.bids, 0);
});

// GetMyeBaySelling marks a relisted original with Relisted alone; the new id comes from GetItem.
Deno.test('a relisted unsold listing is flagged, and GetItem names its relist', () => {
  const item = (id: string) => ({ ItemID: id, Title: 't', SellingStatus: { CurrentPrice: '5.00' } });
  const { listings } = listingsFromResponse(
    { UnsoldList: { ItemArray: { Item: [item('2'), { ...item('3'), Relisted: 'true' }] } } },
    1,
  );
  assertEquals(listings.map((l) => [l.itemId, l.status, l.relisted]), [
    ['2', 'hidden', undefined],
    ['3', 'hidden', true],
  ]);
  const read = (details: Record<string, unknown>) =>
    itemFromResponse({ Item: { ItemID: '3', ListingDetails: details } }).relistedItemId;
  assertEquals(read({ RelistedItemID: '4' }), '4');
  assertEquals(read({}), null);
});

Deno.test('a new listing carries policies, location and the item fields', () => {
  const item = {
    title: 'Levi 501 jeans', categoryId: '11483', price: 25, photos: ['https://i.ebayimg.com/1.jpg'],
    conditionId: 3000, specifics: { Brand: ['Levi'] }, postcode: 'SN8 1UF',
    policies: { shipping: '1', returns: '2', payment: '3' },
  };
  const { xml } = addItemXml(item, 'EBAY_GB');
  for (const part of ['<Quantity>1</Quantity>', '<Currency>GBP</Currency>', '<PostalCode>SN8 1UF</PostalCode>',
    '<ShippingProfileID>1</ShippingProfileID>', '<CategoryID>11483</CategoryID>', '<ListingDuration>GTC</ListingDuration>']) {
    assertEquals(xml!.includes(part), true, part);
  }
  assertEquals(addItemXml({ ...item, policies: {} }, 'EBAY_GB').error?.includes('policies'), true);
});

Deno.test('business policies are grouped by kind', () => {
  const profile = (id: number, type: string, name: string) => ({ ProfileID: id, ProfileType: type, ProfileName: name });
  assertEquals(
    policiesFromPreferences({
      SellerProfilePreferences: {
        SupportedSellerProfiles: {
          SupportedSellerProfile: [profile(1, 'SHIPPING', 'Royal Mail'), profile(2, 'RETURN_POLICY', '30 days'), profile(3, 'PAYMENT', 'Managed')],
        },
      },
    }),
    {
      shipping: [{ id: '1', name: 'Royal Mail' }],
      returns: [{ id: '2', name: '30 days' }],
      payment: [{ id: '3', name: 'Managed' }],
    },
  );
});

Deno.test('a listing without policies lends its postage and returns, inputs only', () => {
  const item =
    '<Item><ShippingDetails><ShippingServiceOptions><ShippingService>UK_RoyalMailSecondClassStandard</ShippingService>' +
    '<ShippingServiceCost currencyID="GBP">3.20</ShippingServiceCost><ShippingTimeMin>2</ShippingTimeMin></ShippingServiceOptions>' +
    '<ShippingType>Flat</ShippingType></ShippingDetails><DispatchTimeMax>2</DispatchTimeMax>' +
    '<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption><ReturnsAccepted>No returns accepted</ReturnsAccepted></ReturnPolicy>' +
    '<ShipToLocations>GB</ShipToLocations><PostalCode>SN8 1UF</PostalCode></Item>';
  const out = shippingFromItemXml(item);
  assertEquals(out.includes('<ShippingService>UK_RoyalMailSecondClassStandard</ShippingService>'), true);
  assertEquals(out.includes('ShippingTimeMin'), false);
  assertEquals(out.includes('<ReturnPolicy><ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption></ReturnPolicy>'), true);
  assertEquals(out.includes('<DispatchTimeMax>2</DispatchTimeMax>'), true);
  assertEquals(out.includes('<ShipToLocations>GB</ShipToLocations>'), true);
  const { xml } = addItemXml(
    { title: 't', categoryId: '1', price: 5, photos: ['u'], postcode: 'SN8 1UF', copiedShipping: out },
    'EBAY_GB',
  );
  assertEquals(xml!.includes('SellerProfiles'), false);
  assertEquals(xml!.includes('<DispatchTimeMax>2</DispatchTimeMax>'), true);
});

Deno.test('postage entered in SaleLinx goes on the listing', () => {
  const out = postageXml({ service: 'UK_RoyalMailSecondClassStandard', cost: 3.2, dispatchDays: 2, returnsDays: 30, returnsPaidBy: 'Buyer' });
  for (const part of ['<ShippingService>UK_RoyalMailSecondClassStandard</ShippingService>', '<ShippingServiceCost>3.20</ShippingServiceCost>',
    '<ReturnsWithinOption>Days_30</ReturnsWithinOption>', '<DispatchTimeMax>2</DispatchTimeMax>']) {
    assertEquals(out.includes(part), true, part);
  }
  assertEquals(postageXml({ service: 'X', cost: 0, returnsDays: 0 }).includes('ReturnsNotAccepted'), true);
  assertEquals(postageXml({ service: '<bad>', cost: 1 }), '');
  const { xml } = addItemXml(
    { title: 't', categoryId: '1', price: 5, photos: ['u'], postcode: 'SN8 1UF', postage: { service: 'X', cost: 1 } },
    'EBAY_GB',
  );
  assertEquals(xml!.includes('<ShippingService>X</ShippingService>'), true);
  assertEquals(
    shippingServicesFromDetails({ ShippingServiceDetails: [
      { ShippingService: 'A', Description: 'Royal Mail', ValidForSellingFlow: 'true' },
      { ShippingService: 'B', ValidForSellingFlow: 'true', InternationalService: 'true' },
      { ShippingService: 'C', ValidForSellingFlow: 'false' },
    ] }),
    [{ id: 'A', name: 'Royal Mail' }],
  );
});

Deno.test('a listing tells its postage in the shape a new listing takes', () => {
  assertEquals(
    postageFromItem({
      ShippingDetails: { ShippingServiceOptions: [{ ShippingService: 'UK_RoyalMailSecondClassStandard', ShippingServiceCost: { '#text': '3.20', '@currencyID': 'GBP' } }] },
      DispatchTimeMax: '1',
      ReturnPolicy: { ReturnsAcceptedOption: 'ReturnsAccepted', ReturnsWithinOption: 'Days_30', ShippingCostPaidByOption: 'Buyer' },
    }),
    { service: 'UK_RoyalMailSecondClassStandard', cost: 3.2, dispatchDays: 1, returnsDays: 30, returnsPaidBy: 'Buyer' },
  );
  assertEquals(postageFromItem({}), null);
});

Deno.test('verifyFromResponse: errors, warnings and fees without throwing', () => {
  const text = `<?xml version="1.0"?><VerifyAddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
    <Ack>Failure</Ack>
    <Errors><ShortMessage>Missing</ShortMessage><LongMessage>Material is required.</LongMessage><ErrorCode>21919303</ErrorCode><SeverityCode>Error</SeverityCode></Errors>
    <Errors><LongMessage>Return policy adjusted.</LongMessage><ErrorCode>21920214</ErrorCode><SeverityCode>Warning</SeverityCode></Errors>
    <Fees><Fee><Name>InsertionFee</Name><Fee currencyID="GBP">0.35</Fee></Fee><Fee><Name>BoldFee</Name><Fee currencyID="GBP">0.0</Fee></Fee><Fee><Name>ListingFee</Name><Fee currencyID="GBP">0.35</Fee></Fee></Fees>
    <CategoryID>36027</CategoryID>
  </VerifyAddFixedPriceItemResponse>`;
  assertEquals(verifyFromResponse(text), {
    ok: false,
    errors: ['21919303: Material is required.'],
    warnings: ['21920214: Return policy adjusted.'],
    fees: [{ name: 'InsertionFee', amount: 0.35, discount: 0 }],
    categoryId: '36027',
  });
});

Deno.test('verifyFromResponse: a fee eBay discounts away (a free listing) costs nothing', () => {
  const text = `<?xml version="1.0"?><VerifyAddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
    <Ack>Success</Ack>
    <Fees><Fee><Name>InsertionFee</Name><Fee currencyID="GBP">0.35</Fee><PromotionalDiscount currencyID="GBP">0.35</PromotionalDiscount></Fee><Fee><Name>SubtitleFee</Name><Fee currencyID="GBP">1.00</Fee><PromotionalDiscount currencyID="GBP">0.40</PromotionalDiscount></Fee><Fee><Name>ListingFee</Name><Fee currencyID="GBP">1.35</Fee></Fee></Fees>
  </VerifyAddFixedPriceItemResponse>`;
  assertEquals(verifyFromResponse(text).fees, [
    { name: 'InsertionFee', amount: 0, discount: 0.35 },
    { name: 'SubtitleFee', amount: 0.6, discount: 0.4 },
  ]);
});

const SITES = { EBAY_US: 0, EBAY_GB: 3, EBAY_DE: 77 };

Deno.test('link site: a new account starts on its registration site', () => {
  assertEquals(linkSiteId(SITES, 'EBAY_US', null, 'seller1'), { siteId: 0, kept: false });
  assertEquals(linkSiteId(SITES, 'EBAY_DE', null, 'seller1'), { siteId: 77, kept: false });
});

Deno.test('link site: an unknown or odd registration falls back to eBay UK', () => {
  assertEquals(linkSiteId(SITES, 'EBAY_PL', null, 'seller1'), { siteId: 3, kept: false });
  assertEquals(linkSiteId(SITES, 'toString', null, 'seller1'), { siteId: 3, kept: false });
  assertEquals(linkSiteId(SITES, undefined, null, 'seller1'), { siteId: 3, kept: false });
});

Deno.test('link site: reconnecting the same account keeps the site the seller picked', () => {
  // Registered on ebay.com, picked ebay.co.uk in SaleLinx
  const prior = { ebay_user_id: 'seller1', site_id: 3 };
  assertEquals(linkSiteId(SITES, 'EBAY_US', prior, 'seller1'), { siteId: 3, kept: true });
});

Deno.test('link site: a different eBay account does not inherit the old pick', () => {
  const prior = { ebay_user_id: 'seller1', site_id: 3 };
  assertEquals(linkSiteId(SITES, 'EBAY_US', prior, 'seller2'), { siteId: 0, kept: false });
});

Deno.test('link site: a stored site this function no longer knows is not kept', () => {
  const prior = { ebay_user_id: 'seller1', site_id: 999 };
  assertEquals(linkSiteId(SITES, 'EBAY_US', prior, 'seller1'), { siteId: 0, kept: false });
});

// The fixed-price calls refuse an auction, and RelistItem refuses a fixed-price listing.
Deno.test('an auction ends, relists and revises through the auction calls', () => {
  assertEquals(listingCall('end', true), 'EndItem');
  assertEquals(listingCall('relist', true), 'RelistItem');
  assertEquals(listingCall('revise', true), 'ReviseItem');
  assertEquals(listingCall('add', true), 'AddItem');
  assertEquals(listingCall('verify', true), 'VerifyAddItem');
});

Deno.test('anything but an explicit auction stays on the fixed-price calls', () => {
  for (const auction of [false, undefined, null, 'true', 1]) {
    assertEquals(listingCall('end', auction), 'EndFixedPriceItem');
    assertEquals(listingCall('relist', auction), 'RelistFixedPriceItem');
    assertEquals(listingCall('revise', auction), 'ReviseFixedPriceItem');
    assertEquals(listingCall('add', auction), 'AddFixedPriceItem');
    assertEquals(listingCall('verify', auction), 'VerifyAddFixedPriceItem');
  }
});

const AUCTION_LISTING = {
  title: 'Nike jersey',
  description: '<p>Hi</p>',
  categoryId: '155183',
  price: 1,
  quantity: 5,
  photos: ['https://i.ebayimg.com/a.jpg'],
  postcode: 'SN8 1UF',
  policies: { shipping: '11', returns: '22', payment: '33' },
};

Deno.test('an auction lists from its starting price, with its Buy It Now, reserve and length', () => {
  const { xml } = addItemXml(
    { ...AUCTION_LISTING, auction: { buyItNow: 50, reserve: 20, duration: 'Days_5' } },
    'EBAY_GB',
  );
  for (const part of [
    '<StartPrice>1.00</StartPrice>',
    '<Quantity>1</Quantity>',
    '<ListingType>Chinese</ListingType>',
    '<ListingDuration>Days_5</ListingDuration>',
    '<BuyItNowPrice>50.00</BuyItNowPrice>',
    '<ReservePrice>20.00</ReservePrice>',
  ]) {
    assertEquals(xml!.includes(part), true, part);
  }
  assertEquals(xml!.includes('GTC'), false);
  assertEquals(xml!.includes('FixedPriceItem'), false);
});

Deno.test('an auction leaves out a Buy It Now or reserve it does not have', () => {
  const { xml } = addItemXml(
    { ...AUCTION_LISTING, auction: { buyItNow: null, reserve: null, duration: 'Days_7' } },
    'EBAY_GB',
  );
  assertEquals(xml!.includes('BuyItNowPrice'), false);
  assertEquals(xml!.includes('ReservePrice'), false);
});

Deno.test('an auction falls back to 7 days, and never sends an unknown length to eBay', () => {
  for (const duration of [null, undefined, 'GTC', '<x>']) {
    const { xml } = addItemXml({ ...AUCTION_LISTING, auction: { duration } }, 'EBAY_GB');
    assertEquals(xml!.includes('<ListingDuration>Days_7</ListingDuration>'), true);
  }
});

Deno.test('a listing with no auction stays fixed price, for as long as it runs', () => {
  const { xml } = addItemXml(AUCTION_LISTING, 'EBAY_GB');
  assertEquals(xml!.includes('<ListingType>FixedPriceItem</ListingType>'), true);
  assertEquals(xml!.includes('<ListingDuration>GTC</ListingDuration>'), true);
  assertEquals(xml!.includes('<Quantity>5</Quantity>'), true);
});

Deno.test('GetItem gives what an auction needs to list again, and nothing for fixed price', () => {
  const base = { ItemID: '1', Quantity: 1, SellingStatus: {}, ReturnPolicy: {} };
  const auction = itemFromResponse({
    Item: {
      ...base,
      ListingType: 'Chinese',
      StartPrice: { '#text': 1, '@currencyID': 'GBP' },
      BuyItNowPrice: { '#text': 50, '@currencyID': 'GBP' },
      ReservePrice: { '#text': 0, '@currencyID': 'GBP' },
      ListingDuration: 'Days_7',
    },
  });
  assertEquals(auction.auction, { startPrice: 1, buyItNow: 50, reserve: null, duration: 'Days_7' });
  const fixed = itemFromResponse({
    Item: { ...base, ListingType: 'FixedPriceItem', StartPrice: { '#text': 9, '@currencyID': 'GBP' } },
  });
  assertEquals('auction' in fixed, false);
});

const BEST_OFFERS = `<?xml version="1.0" encoding="UTF-8"?>
<GetBestOffersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ItemBestOffersArray>
    <ItemBestOffers>
      <Role>Seller</Role>
      <BestOfferArray>
        <BestOffer>
          <BestOfferID>5001</BestOfferID>
          <ExpirationTime>2026-11-05T10:00:00.000Z</ExpirationTime>
          <Buyer><UserID>jeans_fan</UserID></Buyer>
          <Price currencyID="GBP">20.0</Price>
          <Status>Pending</Status>
          <Quantity>1</Quantity>
          <BuyerMessage>Would you take 20?</BuyerMessage>
          <BestOfferCodeType>BuyerBestOffer</BestOfferCodeType>
        </BestOffer>
        <BestOffer>
          <BestOfferID>5002</BestOfferID>
          <Buyer><UserID>other</UserID></Buyer>
          <Price currencyID="GBP">22.0</Price>
          <Status>Pending</Status>
          <BestOfferCodeType>SellerCounterOffer</BestOfferCodeType>
        </BestOffer>
      </BestOfferArray>
      <Item>
        <ItemID>110551234567</ItemID>
        <BuyItNowPrice currencyID="GBP">28.0</BuyItNowPrice>
        <Currency>GBP</Currency>
      </Item>
    </ItemBestOffers>
  </ItemBestOffersArray>
</GetBestOffersResponse>`;

Deno.test('GetBestOffers keeps the offers waiting on the seller', () => {
  const offers = bestOffersFromResponse(parseTrading('GetBestOffers', BEST_OFFERS));
  assertEquals(offers, [
    {
      itemId: '110551234567',
      offerId: '5001',
      buyer: 'jeans_fan',
      price: 20,
      currency: 'GBP',
      listPrice: 28,
      quantity: 1,
      expiresAt: '2026-11-05T10:00:00.000Z',
    },
  ]);
});

Deno.test('a counter sends its total price and quantity; anything unknown is refused', () => {
  const { xml } = respondOfferXml({ itemId: '1', offerId: '2', response: 'Counter', price: 24, currency: 'GBP' });
  assertEquals(
    xml,
    '<ItemID>1</ItemID><BestOfferID>2</BestOfferID><Action>Counter</Action>' +
      '<CounterOfferPrice currencyID="GBP">24.00</CounterOfferPrice><CounterOfferQuantity>1</CounterOfferQuantity>',
  );
  assertEquals(respondOfferXml({ itemId: '1', offerId: '2', response: 'Accept' }).error, undefined);
  assertEquals(respondOfferXml({ itemId: '1', offerId: '2', response: 'Counter', price: 0 }).error !== undefined, true);
  assertEquals(respondOfferXml({ itemId: '1<x/>', offerId: '2', response: 'Accept' }).error !== undefined, true);
  assertEquals(respondOfferXml({ itemId: '1', offerId: '2', response: 'Delete' }).error !== undefined, true);
});

const ORDERS = `<?xml version="1.0" encoding="UTF-8"?>
<GetOrdersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <OrderArray>
    <Order>
      <OrderID>12-34567-89012</OrderID>
      <PaidTime>2026-11-04T09:00:00.000Z</PaidTime>
      <BuyerUserID>jeans_fan</BuyerUserID>
      <ShippingAddress><Name>Sam Buyer</Name></ShippingAddress>
      <Total currencyID="GBP">31.50</Total>
      <ShippingServiceSelected><ShippingService>UK_RoyalMailSecondClassStandard</ShippingService></ShippingServiceSelected>
      <TransactionArray>
        <Transaction>
          <Item><ItemID>110551234567</ItemID><Title>Levi's 501 W32</Title></Item>
          <QuantityPurchased>1</QuantityPurchased>
          <TransactionPrice currencyID="GBP">28.00</TransactionPrice>
          <ShippingServiceSelected><ShippingPackageInfo><HandleByTime>2026-11-06T23:59:59.000Z</HandleByTime></ShippingPackageInfo></ShippingServiceSelected>
        </Transaction>
      </TransactionArray>
    </Order>
    <Order>
      <OrderID>12-34567-00001</OrderID>
      <PaidTime>2026-11-01T09:00:00.000Z</PaidTime>
      <ShippedTime>2026-11-02T09:00:00.000Z</ShippedTime>
      <Total currencyID="GBP">10.00</Total>
    </Order>
    <Order>
      <OrderID>12-34567-00003</OrderID>
      <PaidTime>2026-11-08T09:00:00.000Z</PaidTime>
      <CancelStatus>CancelPending</CancelStatus>
      <ShippedTime>2026-11-09T09:00:00.000Z</ShippedTime>
      <Total currencyID="GBP">12.00</Total>
      <TransactionArray>
        <Transaction>
          <Item><ItemID>110550000003</ItemID><Title>Tee</Title></Item>
          <TransactionPrice currencyID="GBP">12.00</TransactionPrice>
          <ShippingDetails><ShipmentTrackingDetails><ShippingCarrierUsed>Royal Mail</ShippingCarrierUsed><ShipmentTrackingNumber>RM123GB</ShipmentTrackingNumber></ShipmentTrackingDetails></ShippingDetails>
        </Transaction>
      </TransactionArray>
    </Order>
    <Order>
      <OrderID>12-34567-00004</OrderID>
      <PaidTime>2026-11-05T09:00:00.000Z</PaidTime>
      <ShippedTime>2026-11-06T09:00:00.000Z</ShippedTime>
      <Total currencyID="GBP">12.00</Total>
      <TransactionArray>
        <Transaction>
          <Item><ItemID>110550000004</ItemID><Title>Hat</Title></Item>
          <ShippingDetails><ShipmentTrackingDetails><ShipmentTrackingNumber>RM456GB</ShipmentTrackingNumber></ShipmentTrackingDetails></ShippingDetails>
          <ShippingServiceSelected><ShippingPackageInfo><ActualDeliveryTime>2026-11-08T12:00:00.000Z</ActualDeliveryTime></ShippingPackageInfo></ShippingServiceSelected>
        </Transaction>
      </TransactionArray>
    </Order>
    <Order>
      <OrderID>12-34567-00002</OrderID>
      <Total currencyID="GBP">10.00</Total>
    </Order>
  </OrderArray>
</GetOrdersResponse>`;

Deno.test('GetOrders keeps paid orders not yet posted, and labelled ones until delivered', () => {
  assertEquals(openOrdersFromResponse(parseTrading('GetOrders', ORDERS)), [
    {
      shippedAt: null,
      cancelPending: false,
      tracking: null,
      orderId: '12-34567-89012',
      paidAt: '2026-11-04T09:00:00.000Z',
      buyer: 'jeans_fan',
      buyerName: 'Sam Buyer',
      total: 31.5,
      currency: 'GBP',
      service: 'UK_RoyalMailSecondClassStandard',
      shipBy: '2026-11-06T23:59:59.000Z',
      items: [{ itemId: '110551234567', title: "Levi's 501 W32", quantity: 1, price: 28 }],
    },
    {
      shippedAt: '2026-11-09T09:00:00.000Z',
      cancelPending: true,
      tracking: 'RM123GB',
      orderId: '12-34567-00003',
      paidAt: '2026-11-08T09:00:00.000Z',
      buyer: '',
      buyerName: '',
      total: 12,
      currency: 'GBP',
      service: null,
      shipBy: null,
      items: [{ itemId: '110550000003', title: 'Tee', quantity: 1, price: 12 }],
    },
  ]);
});

Deno.test('marking posted sends tracking only with a carrier', () => {
  assertEquals(markShippedXml({ orderId: '12-34567-89012' }).xml, '<OrderID>12-34567-89012</OrderID><Shipped>true</Shipped>');
  assertEquals(
    markShippedXml({ orderId: '1', carrier: 'Royal Mail', tracking: 'AB123' }).xml,
    '<OrderID>1</OrderID><Shipped>true</Shipped><Shipment><ShipmentTrackingDetails>' +
      '<ShippingCarrierUsed>Royal Mail</ShippingCarrierUsed><ShipmentTrackingNumber>AB123</ShipmentTrackingNumber>' +
      '</ShipmentTrackingDetails></Shipment>',
  );
  assertEquals(markShippedXml({ orderId: '1', tracking: 'AB123' }).error !== undefined, true);
  assertEquals(markShippedXml({ orderId: '1<x/>' }).error !== undefined, true);
});
