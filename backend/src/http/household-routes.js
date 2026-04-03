import {
  addItemSchema,
  addMemberSchema,
  addPantrySchema,
  addReceiptSchema,
  barcodeLookupSchema,
  correctOcrSchema,
  createHouseholdSchema,
  enqueueOcrSchema,
  setBudgetSchema,
  toggleItemSchema,
  uploadUrlSchema,
  voiceParseSchema,
} from '../validation.js';
import { parseBooleanQuery, parseValidatedBody, replyJson } from './route-kit.js';

function parseRefreshFlag(url) {
  return parseBooleanQuery({ value: url.searchParams.get('refresh'), code: 'VALIDATION_QUERY_REFRESH', defaultValue: false });
}


function parseRetryControlBody(body) {
  if (!body || Object.keys(body).length === 0) return { replayToken: null };
  if (typeof body !== 'object' || Array.isArray(body)) throw new Error('VALIDATION_PAYLOAD');
  if (body.replayToken === undefined) return { replayToken: null };
  if (typeof body.replayToken !== 'string' || body.replayToken.trim().length < 8) throw new Error('VALIDATION_PAYLOAD');
  return { replayToken: body.replayToken.trim() };
}

export async function handleHouseholdRoutes({ method, url, req, res, userId, requestId, store, logRequest, sendJson, readBody }) {
  const respond = (status, payload) =>
    replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status, payload });

  if (url.pathname === '/households' && method === 'POST') {
    const body = await parseValidatedBody({ req, readBody, schema: createHouseholdSchema });
    const payload = await store.createHousehold({ ownerId: userId, name: body.name, traceContext: { requestId } });
    return respond(201, payload);
  }

  if (url.pathname === '/households' && method === 'GET') {
    const payload = await store.listHouseholdsForUser(userId);
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/members$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: addMemberSchema });
    const payload = await store.addMember({ actorId: userId, householdId, memberId: body.memberId, traceContext: { requestId } });
    return respond(201, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/items$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const payload = await store.getItems({ userId, householdId });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/items$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: addItemSchema });
    const payload = await store.addItem({ userId, householdId, name: body.name, quantity: body.quantity ?? 1, traceContext: { requestId } });
    return respond(201, payload);
  }

  if (method === 'PATCH' && /^\/households\/[^/]+\/items\/[^/]+$/.test(url.pathname)) {
    const [, , householdId, , itemId] = url.pathname.split('/');
    const body = await parseValidatedBody({ req, readBody, schema: toggleItemSchema });
    const payload = await store.toggleItem({ userId, householdId, itemId, expectedVersion: body.expectedVersion, traceContext: { requestId } });
    return respond(200, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/activity$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const payload = await store.getActivity({ userId, householdId });
    return respond(200, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/stream$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    await store.assertMember(userId, householdId);
    return { type: 'sse', householdId };
  }

  if (method === 'GET' && /^\/households\/[^/]+\/budget$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const payload = await store.getBudget({ userId, householdId });
    return respond(200, payload);
  }

  if (method === 'PUT' && /^\/households\/[^/]+\/budget$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: setBudgetSchema });
    const payload = await store.setBudgetLimit({ userId, householdId, limit: body.limit, traceContext: { requestId } });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/receipts\/upload-url$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: uploadUrlSchema });
    const payload = await store.createReceiptUploadUrl({ userId, householdId, fileName: body.fileName, traceContext: { requestId } });
    return respond(201, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/receipts\/ocr-jobs$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: enqueueOcrSchema });
    const payload = await store.enqueueReceiptOcrJob({ userId, householdId, objectKey: body.objectKey, apiRequestId: requestId, traceContext: { requestId } });
    return respond(202, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/receipts\/ocr-jobs$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const payload = await store.listReceiptOcrJobs({ userId, householdId });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/receipts\/ocr-jobs\/[^/]+\/retry$/.test(url.pathname)) {
    const [, , householdId, , , jobId] = url.pathname.split('/');
    const body = parseRetryControlBody(await readBody(req));
    const payload = await store.retryReceiptOcrJob({ userId, householdId, jobId, replayToken: body.replayToken, traceContext: { requestId } });
    return respond(202, payload);
  }

  if (method === 'PATCH' && /^\/households\/[^/]+\/receipts\/ocr-jobs\/[^/]+\/correct$/.test(url.pathname)) {
    const [, , householdId, , , jobId] = url.pathname.split('/');
    const body = await parseValidatedBody({ req, readBody, schema: correctOcrSchema });
    const payload = await store.correctReceiptOcrJob({ userId, householdId, jobId, store: body.store, items: body.items, traceContext: { requestId } });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/receipts\/ocr-jobs\/[^/]+\/apply$/.test(url.pathname)) {
    const [, , householdId, , , jobId] = url.pathname.split('/');
    const payload = await store.applyReceiptOcrJobResult({ userId, householdId, jobId, applyRequestId: requestId, traceContext: { requestId } });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/receipts$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: addReceiptSchema });
    const payload = await store.addReceipt({ userId, householdId, store: body.store ?? 'unknown', items: body.items, traceContext: { requestId } });
    return respond(201, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/receipts$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const payload = await store.listReceipts({ userId, householdId });
    return respond(200, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/pantry$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const payload = await store.getPantry({ userId, householdId });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/pantry$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: addPantrySchema });
    const payload = await store.addPantryItem({ userId, householdId, name: body.name, quantity: body.quantity ?? 1, traceContext: { requestId } });
    return respond(201, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/voice\/parse$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: voiceParseSchema });
    const payload = await store.parseVoiceItems({
      userId,
      householdId,
      transcript: body.transcript,
      locale: body.locale ?? 'ks',
      addToList: body.addToList ?? false,
      contractVersion: body.contractVersion ?? 'v1',
      traceContext: { requestId },
    });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/barcodes\/lookup$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const body = await parseValidatedBody({ req, readBody, schema: barcodeLookupSchema });
    const payload = await store.lookupBarcode({
      userId,
      householdId,
      barcode: body.barcode,
      locale: body.locale ?? 'ks',
      quantity: body.quantity ?? 1,
      addToList: body.addToList ?? false,
      traceContext: { requestId },
    });
    return respond(200, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/pricing\/estimate$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const refresh = parseRefreshFlag(url);
    const payload = await store.estimatePrices({ userId, householdId, refresh });
    return respond(200, payload);
  }

  if (method === 'GET' && /^\/households\/[^/]+\/flyers$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const payload = await store.listFlyers({ userId, householdId });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/recipes\/[^/]+\/add-to-list$/.test(url.pathname)) {
    const [, , householdId, , recipeKey] = url.pathname.split('/');
    const payload = await store.addRecipeIngredientsToList({ userId, householdId, recipeKey, traceContext: { requestId } });
    return respond(200, payload);
  }

  if (method === 'POST' && /^\/households\/[^/]+\/recipes\/suggest$/.test(url.pathname)) {
    const householdId = url.pathname.split('/')[2];
    const refresh = parseRefreshFlag(url);
    const payload = await store.suggestRecipes({ userId, householdId, refresh });
    return respond(200, payload);
  }

  return false;
}
