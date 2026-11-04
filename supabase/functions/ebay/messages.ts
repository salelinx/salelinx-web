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
/** Most photos to a message. The Trading docs give no number, and the Message API's say five. */
export const MAX_MESSAGE_PHOTOS = 5;
const MAX_PHOTO_URL_CHARS = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

const windowStart = (maxAgeDays: unknown, now: Date): string => {
  const asked = Number(maxAgeDays);
  const days = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 30) : 3;
  return new Date(now.getTime() - days * DAY_MS).toISOString();
};

const FIRST_PAGE =
  '<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>';

const windowQuery = (maxAgeDays: unknown, now: Date): string =>
  `<StartCreationTime>${windowStart(maxAgeDays, now)}</StartCreationTime>` +
  `<EndCreationTime>${now.toISOString()}</EndCreationTime>${FIRST_PAGE}`;

/** Every question and its photos, but no answers. One call however many threads there are, which the
 *  shared daily quota pays for. `All`, because `AskSellerQuestion` alone returned nothing for a
 *  question waiting on a reply. */
export function memberMessagesQuery(maxAgeDays: unknown, now: Date): string {
  return `<MailMessageType>All</MailMessageType>${windowQuery(maxAgeDays, now)}`;
}

/** Answered questions with their answers, but no photos. On a real account (2026-11-04) neither read
 *  returned both, so it takes the two. */
export function answersQuery(maxAgeDays: unknown, now: Date): string {
  return (
    '<MailMessageType>AskSellerQuestion</MailMessageType><MessageStatus>Answered</MessageStatus>' +
    windowQuery(maxAgeDays, now)
  );
}

/** The inbox's headers over the same window: neither read above says what has been read, and this
 *  does. Headers, as the full messages only come ten at a time. */
export function inboxHeadersQuery(maxAgeDays: unknown, now: Date): string {
  return (
    '<DetailLevel>ReturnHeaders</DetailLevel><FolderID>0</FolderID>' +
    `<StartTime>${windowStart(maxAgeDays, now)}</StartTime><EndTime>${now.toISOString()}</EndTime>` +
    FIRST_PAGE
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

const exchangesOf = (body) => list(body?.MemberMessage?.MemberMessageExchange);

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

/** Whether a question has an answer this read left out, as fetching them spends the shared quota. */
export function answersMissing(body): boolean {
  return exchangesOf(body).some((e) => e?.MessageStatus === 'Answered' && e.Response == null);
}

/** Puts answers on the questions they belong to. `answered` is null when that read failed: the list
 *  still stands, and those threads go on saying nothing about who spoke last. */
export function withAnswers(body, answered) {
  const byQuestion = new Map(
    exchangesOf(answered)
      .filter((e) => e?.Question?.MessageID && e.Response != null)
      .map((e) => [String(e.Question.MessageID), e.Response]),
  );
  return {
    ...body,
    MemberMessage: {
      ...body?.MemberMessage,
      MemberMessageExchange: exchangesOf(body).map((e) => {
        const response = byQuestion.get(String(e?.Question?.MessageID));
        return response != null && e.Response == null ? { ...e, Response: response } : e;
      }),
    },
  };
}

/** Whether anything is waiting on a reply. An answered question has been read, so without one the
 *  shared quota needn't pay to ask. */
export function hasUnanswered(body): boolean {
  return exchangesOf(body).some((e) => e?.Question?.MessageID && e.MessageStatus !== 'Answered');
}

/** Marks the questions eBay's inbox has as unread, matching its ExternalMessageID to the question's
 *  MessageID (the two were equal on a real account, 2026-11-04). `inbox` is null when that read was
 *  skipped or failed, which reads as nothing unread. */
export function withReadState(body, inbox) {
  const unread = new Set(
    list(inbox?.Messages?.Message)
      .filter((m) => m?.ExternalMessageID && m.Read === 'false')
      .map((m) => String(m.ExternalMessageID)),
  );
  return {
    ...body,
    MemberMessage: {
      ...body?.MemberMessage,
      MemberMessageExchange: exchangesOf(body).map((e) =>
        unread.has(String(e?.Question?.MessageID)) ? { ...e, Unread: true } : e,
      ),
    },
  };
}

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
      unread: 0,
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
    if (!askedByMe && exchange.Unread) thread.unread += 1;
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
    // Answered with no text to show, when reading the answers failed: this thread can't say what
    // came last, and the pill promises a customer is waiting.
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

/** Attached by address, from uploadMessagePhoto. eBay checks each and refuses one that doesn't exist. */
function mediaXml(photos: unknown): string {
  const list = photos ?? [];
  if (!Array.isArray(list) || list.length > MAX_MESSAGE_PHOTOS) {
    throw new EbayError(`A message takes up to ${MAX_MESSAGE_PHOTOS} photos`, 'bad_request');
  }
  return list
    .map((url, i) => {
      if (typeof url !== 'string' || !url.startsWith('https://') || url.length > MAX_PHOTO_URL_CHARS) {
        throw new EbayError('Bad photo address', 'bad_request');
      }
      return `<MessageMedia><MediaName>Photo ${i + 1}</MediaName><MediaURL>${esc(url)}</MediaURL></MessageMedia>`;
    })
    .join('');
}

/** AddMemberMessageRTQ. Never public: left out, a reply's visibility on the listing would be eBay's
 *  call rather than the seller's. A photo can't go alone, as eBay requires the body. */
export function replyXml(reply, text: unknown, photos?: unknown): string {
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
    mediaXml(photos) +
    `<ParentMessageID>${esc(reply.parentMessageId)}</ParentMessageID>` +
    `<RecipientID>${esc(reply.recipientId)}</RecipientID></MemberMessage>`
  );
}
