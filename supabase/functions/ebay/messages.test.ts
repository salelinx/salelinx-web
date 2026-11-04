// deno test supabase/functions/ebay/
// The exchange's shape is from a real GetMemberMessages answer (2026-11-03), with its text replaced.

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { EbayError } from './trading.ts';
import {
  answersMissing,
  answersQuery,
  conversationsFromResponse,
  hasUnanswered,
  inboxHeadersQuery,
  MAX_MESSAGE_CHARS,
  MAX_MESSAGE_PHOTOS,
  memberMessagesQuery,
  replyXml,
  withAnswers,
  withReadState,
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
      unread: 0,
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

Deno.test('photos go in a reply where eBay expects them, and a reply without any is unchanged', () => {
  const url = 'https://i.ebayimg.com/images/g/abc/s-l1600.jpg';
  const xml = replyXml(target, 'See this', [url, url + '2']);
  assertEquals(
    xml.includes(
      '<DisplayToPublic>false</DisplayToPublic>' +
        `<MessageMedia><MediaName>Photo 1</MediaName><MediaURL>${url}</MediaURL></MessageMedia>` +
        `<MessageMedia><MediaName>Photo 2</MediaName><MediaURL>${url}2</MediaURL></MessageMedia>` +
        '<ParentMessageID>',
    ),
    true,
  );
  assertEquals(replyXml(target, 'hi', []), replyXml(target, 'hi'));
  assertEquals(replyXml(target, 'hi', null), replyXml(target, 'hi'));
});

Deno.test('photos are checked before they reach eBay', () => {
  const url = 'https://i.ebayimg.com/a.jpg';
  assertEquals(replyXml(target, 'hi', Array(MAX_MESSAGE_PHOTOS).fill(url)).length > 0, true);
  for (const photos of [
    Array(MAX_MESSAGE_PHOTOS + 1).fill(url),
    'https://i.ebayimg.com/a.jpg',
    [42],
    ['http://i.ebayimg.com/a.jpg'],
    ['javascript:alert(1)'],
    ['https://i.ebayimg.com/' + 'x'.repeat(200)],
    ['https://evil.example/a.jpg'],
    ['https://ebayimg.com.evil.example/a.jpg'],
  ]) {
    assertThrows(() => replyXml(target, 'hi', photos), EbayError);
  }
  // A photo can't go alone: eBay requires the body.
  assertThrows(() => replyXml(target, '  ', [url]), EbayError);
  assertEquals(replyXml(target, 'hi', [url + '?a=1&b=2<c>']).includes('a=1&amp;b=2&lt;c&gt;'), true);
});

// index.ts can't be imported here (it starts a server), so these are checked in its source.
Deno.test('a reply photo is checked against the plan and counted before it is decoded or sent', () => {
  const index = source('./index.ts').replace(/\r\n/g, '\n');
  const from = index.indexOf("case 'uploadMessagePhoto': {");
  const code = index.slice(from, index.indexOf('\n      case ', from + 1));
  const plan = code.indexOf("checkFeatureAllowed(userScoped, user.id, 'messages', 'ebay')");
  const refuse = code.indexOf('if (!gate.ok) return json(gate.status, gate.body);');
  const count = code.indexOf('countMessagePhoto(userScoped, user.id)');
  const upload = code.indexOf('await uploadMessagePhoto(');
  assertEquals(plan >= 0 && plan < refuse && refuse < count && count < upload, true);
});

Deno.test('a reply photo goes through the strict checks, both ways', () => {
  const index = source('./index.ts').replace(/\r\n/g, '\n');
  const from = index.indexOf('async function uploadMessagePhoto(');
  const fn = index.slice(from, index.indexOf('\n}\n', from));
  assertEquals(fn.includes('decodeMessagePhoto(dataUrl)'), true);
  assertEquals(fn.includes('photoBlob('), false);
  assertEquals(fn.includes('!isEbayPhotoUrl(url)'), true);
});

// The two reads of one answered question, from a real account (2026-11-04), with the text replaced.
const PHOTO = 'https://i.ebayimg.com/images/a.jpg';
const answeredInAll = () =>
  exchange({
    MessageStatus: 'Answered',
    LastModifiedDate: '2026-11-01T11:00:00.000Z',
    MessageMedia: { MediaName: 'a', MediaURL: PHOTO },
  });
const answeredInAnswers = () =>
  exchange({
    MessageStatus: 'Answered',
    LastModifiedDate: '2026-11-01T11:00:00.000Z',
    Response: 'Yes, still here',
  });

Deno.test('the two reads together give the reply and the photo', () => {
  const merged = withAnswers(answer(answeredInAll()), answer(answeredInAnswers()));
  const [thread] = conversationsFromResponse(merged, me);
  assertEquals(
    thread.messages.map((m) => [m.text, m.fromMe, m.photos ?? null]),
    [
      ['Could I buy this?', false, [PHOTO]],
      ['Yes, still here', true, null],
    ],
  );
  assertEquals(thread.fromMe, true);
  assertEquals(thread.text, 'Yes, still here');
  assertEquals(thread.at, Date.parse('2026-11-01T11:00:00.000Z'));
});

Deno.test('a reply stays on its own question', () => {
  const other = exchange({ MessageStatus: 'Unanswered' }, { MessageID: '9002', Body: 'And this?' });
  const merged = withAnswers(answer(answeredInAll(), other), answer(answeredInAnswers()));
  assertEquals(merged.MemberMessage.MemberMessageExchange[1].Response, undefined);
});

Deno.test('a buyer writing again after the reply still needs one', () => {
  const again = exchange(
    { CreationDate: '2026-11-01T12:00:00.000Z', LastModifiedDate: '2026-11-01T12:00:00.000Z' },
    { MessageID: '9002', Body: 'Thanks, how much is postage?' },
  );
  const merged = withAnswers(answer(answeredInAll(), again), answer(answeredInAnswers()));
  const [thread] = conversationsFromResponse(merged, me);
  assertEquals(thread.fromMe, false);
  assertEquals(thread.parentMessageId, '9002');
});

Deno.test('if reading the answers fails, the list stands and promises nothing', () => {
  const [thread] = conversationsFromResponse(withAnswers(answer(answeredInAll()), null), me);
  assertEquals(thread.fromMe, null);
  assertEquals(thread.messages.length, 1);
  assertEquals(thread.messages[0].photos, [PHOTO]);
});

Deno.test('the second read is only spent when an answer is missing', () => {
  assertEquals(answersMissing(answer(answeredInAll())), true);
  assertEquals(answersMissing(answer(exchange())), false);
  assertEquals(answersMissing(answer(answeredInAnswers())), false);
  assertEquals(answersMissing({}), false);
});

Deno.test('both reads cover the same window', () => {
  const now = new Date('2026-11-04T00:00:00.000Z');
  const window = (q: string) => q.slice(q.indexOf('<StartCreationTime>'));
  assertEquals(window(answersQuery(7, now)), window(memberMessagesQuery(7, now)));
  assertEquals(answersQuery(7, now).includes('<MessageStatus>Answered</MessageStatus>'), true);
  assertEquals(
    answersQuery(7, now).includes('<MailMessageType>AskSellerQuestion</MailMessageType>'),
    true,
  );
});

// A row of the inbox's headers, from a real account (2026-11-04).
const inboxRow = (over = {}) => ({
  Sender: 'buyer_jo',
  MessageID: '555',
  ExternalMessageID: '9001',
  Read: 'false',
  MessageType: 'AskSellerQuestion',
  ...over,
});
const inboxOf = (...rows) => ({ Messages: { Message: rows.length === 1 ? rows[0] : rows } });

Deno.test('a question eBay has as unread counts on its thread', () => {
  const merged = withReadState(answer(exchange()), inboxOf(inboxRow()));
  assertEquals(conversationsFromResponse(merged, me)[0].unread, 1);
});

Deno.test('a question eBay has as read does not', () => {
  const merged = withReadState(answer(exchange()), inboxOf(inboxRow({ Read: 'true' })));
  assertEquals(conversationsFromResponse(merged, me)[0].unread, 0);
});

Deno.test('every unread question in a thread counts', () => {
  const second = exchange({}, { MessageID: '9002', Body: 'And postage?' });
  const merged = withReadState(
    answer(exchange(), second),
    inboxOf(inboxRow(), inboxRow({ ExternalMessageID: '9002', MessageID: '556' })),
  );
  assertEquals(conversationsFromResponse(merged, me)[0].unread, 2);
});

Deno.test("it matches on the question, not the inbox row's own id", () => {
  const merged = withReadState(answer(exchange()), inboxOf(inboxRow({ ExternalMessageID: '1' })));
  assertEquals(conversationsFromResponse(merged, me)[0].unread, 0);
});

Deno.test('our own message unread by the other side is not unread for us', () => {
  const mine = exchange({}, { SenderID: 'My_Shop', RecipientID: 'buyer_jo' });
  const merged = withReadState(answer(mine), inboxOf(inboxRow()));
  assertEquals(conversationsFromResponse(merged, me)[0].unread, 0);
});

Deno.test('with no inbox read, nothing is unread and the list stands', () => {
  const merged = withReadState(answer(exchange()), null);
  const [thread] = conversationsFromResponse(merged, me);
  assertEquals(thread.unread, 0);
  assertEquals(thread.messages.length, 1);
});

Deno.test('the inbox is only read when something is waiting', () => {
  assertEquals(hasUnanswered(answer(exchange())), true);
  assertEquals(hasUnanswered(answer(answeredInAll())), false);
  assertEquals(hasUnanswered({}), false);
});

Deno.test('the inbox read covers the same window and only asks for headers', () => {
  const now = new Date('2026-11-04T00:00:00.000Z');
  const query = inboxHeadersQuery(7, now);
  const start = memberMessagesQuery(7, now).match(/<StartCreationTime>(.*?)</)?.[1];
  assertEquals(query.includes(`<StartTime>${start}</StartTime>`), true);
  assertEquals(query.includes('<DetailLevel>ReturnHeaders</DetailLevel>'), true);
  assertEquals(query.includes('<FolderID>0</FolderID>'), true);
});

Deno.test('the function reads the inbox and merges it', () => {
  const index = source('./index.ts');
  assertEquals(index.includes('hasUnanswered(answer)'), true);
  assertEquals(index.includes('withReadState('), true);
});

Deno.test('a failed extra read sends back its code and no text', () => {
  const index = source('./index.ts');
  assertEquals(index.includes("partial[name] = e?.code ?? 'failed'"), true);
});

Deno.test('the function reads the answers and merges them', () => {
  const index = source('./index.ts');
  assertEquals(index.includes('answersMissing(answer)'), true);
  assertEquals(index.includes('withAnswers(answer, answered)'), true);
});

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
