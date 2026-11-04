// deno test supabase/functions/ebay/
// The exchange's shape is from a real GetMemberMessages answer (2026-11-03), with its text replaced.

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { EbayError } from './trading.ts';
import {
  conversationsFromResponse,
  MAX_MESSAGE_CHARS,
  memberMessagesQuery,
  replyXml,
} from './messages.ts';

const me = { userId: 'u-immutable-1', username: 'My_Shop' };

const exchange = (over = {}, question = {}) => ({
  Item: { ItemID: '111222333', Title: 'Black Velvet Crossbody Bag' },
  Question: {
    MessageType: 'AskSellerQuestion',
    QuestionType: 'General',
    DisplayToPublic: 'false',
    SenderID: 'buyer_jo',
    SenderEmail: 'buyer@example.com',
    RecipientID: 'my_shop',
    Subject: 'Question about your item',
    Body: 'Could I buy this?',
    MessageID: '9001',
    ...question,
  },
  MessageStatus: 'Unanswered',
  CreationDate: '2026-11-01T10:00:00.000Z',
  LastModifiedDate: '2026-11-01T10:00:00.000Z',
  ...over,
});

const answer = (...exchanges) => ({
  MemberMessage: {
    MemberMessageExchange: exchanges.length === 1 ? exchanges[0] : exchanges,
  },
});

Deno.test('an unanswered question reads as the customer speaking last', () => {
  assertEquals(conversationsFromResponse(answer(exchange()), me), [
    {
      id: '111222333:buyer_jo',
      title: 'Black Velvet Crossbody Bag',
      listingId: '111222333',
      otherParty: 'buyer_jo',
      messages: [
        {
          id: '9001',
          text: 'Could I buy this?',
          at: Date.parse('2026-11-01T10:00:00.000Z'),
          fromMe: false,
          from: 'buyer_jo',
          photos: [],
        },
      ],
      parentMessageId: '9001',
      fromMe: false,
      text: 'Could I buy this?',
      at: Date.parse('2026-11-01T10:00:00.000Z'),
    },
  ]);
});

Deno.test('a photo the buyer attached comes with their message', () => {
  const photos = (over, question = {}) =>
    conversationsFromResponse(answer(exchange(over, question)), me)[0].messages[0].photos;
  const url = 'https://i.ebayimg.com/images/a.jpg';
  // Where a real answer put it.
  assertEquals(photos({ MessageMedia: { MediaName: 'a', MediaURL: url } }), [url]);
  // Where the docs put it, and several at once.
  assertEquals(photos({}, { MessageMedia: [{ MediaURL: url }, { MediaURL: url + '2' }] }), [
    url,
    url + '2',
  ]);
  // The same photo in both places shows once.
  assertEquals(photos({ MessageMedia: { MediaURL: url } }, { MessageMedia: { MediaURL: url } }), [
    url,
  ]);
});

Deno.test('only https photos reach the extension, which links and shows them', () => {
  const photos = (MediaURL) =>
    conversationsFromResponse(answer(exchange({ MessageMedia: { MediaURL } })), me)[0].messages[0]
      .photos;
  assertEquals(photos('http://example.com/a.jpg'), []);
  assertEquals(photos('javascript:alert(1)'), []);
  assertEquals(photos(undefined), []);
});

Deno.test("the buyer's email address never leaves the function", () => {
  const out = JSON.stringify(conversationsFromResponse(answer(exchange()), me));
  assertEquals(out.includes('buyer@example.com'), false);
});

Deno.test('an answered question reads as us speaking last, answer included', () => {
  const [row] = conversationsFromResponse(
    answer(
      exchange({
        MessageStatus: 'Answered',
        Response: 'Yes, it is yours',
        LastModifiedDate: '2026-11-01T12:00:00.000Z',
      }),
    ),
    me,
  );
  assertEquals(row.fromMe, true);
  assertEquals(row.text, 'Yes, it is yours');
  assertEquals(row.at, Date.parse('2026-11-01T12:00:00.000Z'));
  assertEquals(
    row.messages.map((m) => [m.text, m.fromMe]),
    [
      ['Could I buy this?', false],
      ['Yes, it is yours', true],
    ],
  );
});

Deno.test('several answers all show, as one or as a list', () => {
  const [row] = conversationsFromResponse(
    answer(
      exchange({
        MessageStatus: 'Answered',
        Response: ['One', { '#text': 'Two' }],
      }),
    ),
    me,
  );
  assertEquals(
    row.messages.map((m) => m.text),
    ['Could I buy this?', 'One', 'Two'],
  );
});

Deno.test('answered with no text to show stays unknown, so no pill and no "You:"', () => {
  const [row] = conversationsFromResponse(answer(exchange({ MessageStatus: 'Answered' })), me);
  assertEquals(row.fromMe, null);
  assertEquals(row.text, 'Could I buy this?');
});

Deno.test('a follow-up after our answer needs a reply, and answers the newest question', () => {
  const [row] = conversationsFromResponse(
    answer(
      exchange(
        {
          MessageStatus: 'Answered',
          Response: 'Yes',
          CreationDate: '2026-11-01T10:00:00.000Z',
          LastModifiedDate: '2026-11-01T11:00:00.000Z',
        },
        { MessageID: '9001' },
      ),
      exchange(
        {
          CreationDate: '2026-11-01T12:00:00.000Z',
          LastModifiedDate: '2026-11-01T12:00:00.000Z',
        },
        { MessageID: '9002', Body: 'Would you take less?' },
      ),
    ),
    me,
  );
  assertEquals(row.fromMe, false);
  assertEquals(row.parentMessageId, '9002');
  assertEquals(
    row.messages.map((m) => m.id),
    ['9001', '9001-0', '9002'],
  );
});

Deno.test('a thread is a buyer and a listing', () => {
  const rows = conversationsFromResponse(
    answer(
      exchange({}, { MessageID: '1' }),
      exchange({}, { MessageID: '2', SenderID: 'someone_else' }),
      exchange({ Item: { ItemID: '444', Title: 'Other' } }, { MessageID: '3' }),
    ),
    me,
  );
  assertEquals(rows.map((r) => r.id).sort(), [
    '111222333:buyer_jo',
    '111222333:someone_else',
    '444:buyer_jo',
  ]);
});

Deno.test('our own question names the other member, in any case', () => {
  const [row] = conversationsFromResponse(
    answer(exchange({}, { SenderID: 'MY_SHOP', RecipientID: 'buyer_jo' })),
    me,
  );
  assertEquals(row.fromMe, true);
  assertEquals(row.otherParty, 'buyer_jo');
});

Deno.test('newest conversation first, whatever order eBay sends', () => {
  const rows = conversationsFromResponse(
    answer(
      exchange({}, { MessageID: '1', SenderID: 'older' }),
      exchange({ CreationDate: '2026-11-02T10:00:00.000Z' }, { MessageID: '2', SenderID: 'newer' }),
    ),
    me,
  );
  assertEquals(
    rows.map((r) => r.otherParty),
    ['newer', 'older'],
  );
});

Deno.test('no messages, or a malformed answer, reads as no conversations', () => {
  assertEquals(conversationsFromResponse({}, me), []);
  assertEquals(conversationsFromResponse({ MemberMessage: 'nope' }, me), []);
  assertEquals(conversationsFromResponse(answer({ Item: {} }), me), []);
});

Deno.test('the age window is the days asked for, within what the tab offers', () => {
  const now = new Date('2026-11-03T12:00:00.000Z');
  const startOf = (days: unknown) =>
    memberMessagesQuery(days, now).match(/<StartCreationTime>([^<]+)/)![1];
  assertEquals(startOf(7), '2026-10-27T12:00:00.000Z');
  assertEquals(startOf(365), '2026-10-04T12:00:00.000Z');
  assertEquals(startOf(undefined), '2026-10-31T12:00:00.000Z');
  assertEquals(startOf(-1), '2026-10-31T12:00:00.000Z');
  // The type that sounds right returned nothing for a real AskSellerQuestion.
  assertEquals(memberMessagesQuery(3, now).includes('<MailMessageType>All<'), true);
});

const target = {
  itemId: '111222333',
  parentMessageId: '9001',
  recipientId: 'buyer_jo',
};

Deno.test('a reply goes to the question, the buyer and the listing, never in public', () => {
  const xml = replyXml(target, '  Yes it is  ');
  assertEquals(xml.includes('<ItemID>111222333</ItemID>'), true);
  assertEquals(xml.includes('<Body>Yes it is</Body>'), true);
  assertEquals(xml.includes('<ParentMessageID>9001</ParentMessageID>'), true);
  assertEquals(xml.includes('<RecipientID>buyer_jo</RecipientID>'), true);
  assertEquals(xml.includes('<DisplayToPublic>false</DisplayToPublic>'), true);
});

Deno.test('what a seller or buyer typed cannot change the request', () => {
  const xml = replyXml(
    { ...target, recipientId: 'a</RecipientID><X>', parentMessageId: '1<2' },
    '<b>5 & 6</b>',
  );
  assertEquals(xml.includes('<X>'), false);
  assertEquals(xml.includes('<b>'), false);
  assertEquals(xml.includes('&lt;b&gt;5 &amp; 6&lt;/b&gt;'), true);
  assertThrows(() => replyXml({ ...target, itemId: '1</ItemID>' }, 'hi'), EbayError);
});

Deno.test('a reply is checked before it reaches eBay', () => {
  assertEquals(replyXml(target, 'x'.repeat(MAX_MESSAGE_CHARS)).length > 0, true);
  for (const [reply, text] of [
    [undefined, 'hi'],
    [{ ...target, itemId: '' }, 'hi'],
    [{ ...target, parentMessageId: '' }, 'hi'],
    [{ ...target, recipientId: '' }, 'hi'],
    [target, ''],
    [target, '   '],
    [target, 42],
    [target, 'x'.repeat(MAX_MESSAGE_CHARS + 1)],
  ]) {
    assertThrows(() => replyXml(reply, text), EbayError);
  }
});

// index.ts can't be imported here (it starts a server), so these are checked in its source.
const source = (file: string) => Deno.readTextFileSync(new URL(file, import.meta.url));

Deno.test('messages ask for no new permission', () => {
  // Adding a scope breaks every linked seller: a refresh sends this list, and eBay refuses more than
  // they consented to.
  const index = source('./index.ts');
  assertEquals(index.includes('commerce.message'), false);
  assertEquals(index.includes('MESSAGE_SCOPE'), false);
});

Deno.test('nothing about a message is logged', () => {
  assertEquals(source('./messages.ts').includes('console.'), false);
  const cases =
    source('./index.ts').match(/case 'conversations':[\s\S]*?case 'shippingServices'/)?.[0] ?? '';
  assertEquals(cases.length > 0, true);
  assertEquals(cases.includes('console.'), false);
});
