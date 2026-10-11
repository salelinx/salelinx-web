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
