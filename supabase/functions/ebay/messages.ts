// A seller's messages from buyers, through the Trading API. eBay's newer Message API looks like the
// place for this but returned none of them on a real account (2026-11-03: FROM_MEMBERS total 0 with
// a buyer's question waiting), only eBay's own notices.
//
// Buyer messages pass through here in memory on their way to the extension. They must never be
// logged or stored (docs/GDPR.md). eBay also sends the buyer's email address: it is left behind here.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { EbayError, esc } from './trading.ts';

/** eBay's limit on a message. */
export const MAX_MESSAGE_CHARS = 2000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One call however many threads there are, as each comes with its question and answers. The shared
 *  daily quota pays for it. `All`, because `AskSellerQuestion` returned nothing for a question whose
 *  own type is AskSellerQuestion. */
export function memberMessagesQuery(maxAgeDays: unknown, now: Date): string {
  const asked = Number(maxAgeDays);
  const days = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 30) : 3;
  const start = new Date(now.getTime() - days * DAY_MS).toISOString();
  return (
    '<MailMessageType>All</MailMessageType>' +
    `<StartCreationTime>${start}</StartCreationTime><EndCreationTime>${now.toISOString()}</EndCreationTime>` +
    '<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>'
  );
}

export interface Me {
  userId?: string | null;
  username?: string | null;
}

const same = (a: unknown, b: unknown) =>
  !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

const isMe = (name: unknown, me: Me) => same(name, me.userId) || same(name, me.username);

const list = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

const textOf = (x) => String((x && typeof x === 'object' ? x['#text'] : x) ?? '');

const timeOf = (date: unknown) => Date.parse(String(date)) || 0;

/** Photos a member attached. On a real answer they sat on the exchange, and the docs put them on the
 *  question too. https only, as the extension shows these as images and links. */
const photosOf = (exchange, question): string[] => [
  ...new Set(
    [...list(exchange.MessageMedia), ...list(question.MessageMedia)]
      .map((media) => textOf(media?.MediaURL))
      .filter((url) => url.startsWith('https://')),
  ),
];

/** A thread is a buyer and a listing: eBay files each question separately. Answers carry no date of
 *  their own, so the exchange's last change stands in for one. */
export function conversationsFromResponse(body, me: Me) {
  const threads = new Map();
  for (const exchange of list(body?.MemberMessage?.MemberMessageExchange)) {
    const question = exchange?.Question;
    if (!question?.MessageID) continue;

    const askedByMe = isMe(question.SenderID, me);
    const buyer = String((askedByMe ? list(question.RecipientID)[0] : question.SenderID) ?? '');
    const listingId = exchange.Item?.ItemID ? String(exchange.Item.ItemID) : null;
    const id = `${listingId ?? ''}:${buyer}`;
    const thread = threads.get(id) ?? {
      id,
      title: textOf(exchange.Item?.Title ?? question.Subject),
      listingId,
      otherParty: buyer,
      messages: [],
      parentMessageId: null,
      parentAt: -1,
      unknownAnswers: new Set(),
    };
    threads.set(id, thread);

    const at = timeOf(exchange.CreationDate);
    const questionId = String(question.MessageID);
    thread.messages.push({
      id: questionId,
      text: textOf(question.Body),
      at,
      fromMe: askedByMe,
      from: String(question.SenderID ?? ''),
      photos: photosOf(exchange, question),
    });
    // What gets answered: the buyer's newest question.
    if (!askedByMe && at >= thread.parentAt) {
      thread.parentMessageId = questionId;
      thread.parentAt = at;
    }

    const answers = list(exchange.Response);
    answers.forEach((answer, i) => {
      thread.messages.push({
        id: `${questionId}-${i}`,
        text: textOf(answer),
        at: timeOf(exchange.LastModifiedDate) || at,
        fromMe: !askedByMe,
        from: '',
      });
    });
    // Answered with no text to show, as on eBay's site if it withholds it: nobody can say who spoke
    // last from this, and the pill promises a customer is waiting.
    if (exchange.MessageStatus === 'Answered' && answers.length === 0) {
      thread.unknownAnswers.add(questionId);
    }
  }

  return [...threads.values()]
    .map(({ parentAt: _parentAt, unknownAnswers, ...thread }) => {
      const messages = thread.messages.sort((a, b) => a.at - b.at);
      const last = messages[messages.length - 1];
      return {
        ...thread,
        messages,
        fromMe: unknownAnswers.has(last.id) ? null : last.fromMe,
        text: last.text,
        at: last.at,
      };
    })
    .sort((a, b) => b.at - a.at);
}

/** AddMemberMessageRTQ. Never public: left out, a reply's visibility on the listing would be eBay's
 *  call rather than the seller's. */
export function replyXml(reply, text: unknown): string {
  if (!/^\d+$/.test(String(reply?.itemId))) throw new EbayError('Missing item', 'bad_request');
  if (!reply?.parentMessageId) throw new EbayError('Missing question', 'bad_request');
  if (!reply?.recipientId) throw new EbayError('Missing recipient', 'bad_request');
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) throw new EbayError('Message is empty', 'bad_request');
  if (body.length > MAX_MESSAGE_CHARS) {
    throw new EbayError(`Message is over ${MAX_MESSAGE_CHARS} characters`, 'bad_request');
  }
  return (
    `<ItemID>${reply.itemId}</ItemID><MemberMessage><Body>${esc(body)}</Body>` +
    '<DisplayToPublic>false</DisplayToPublic>' +
    `<ParentMessageID>${esc(reply.parentMessageId)}</ParentMessageID>` +
    `<RecipientID>${esc(reply.recipientId)}</RecipientID></MemberMessage>`
  );
}
