const Offer = require('../models/mongoose/Offer');
const allowedDurations = new Map([['1 hour', 1], ['2 hours', 2], ['Until closing', 8]]);
const allowedVibes = new Set(['Solo & Quiet', 'Local Artisans', 'Hidden Food', 'Culture & Heritage', 'Nightlife']);

async function readOffers() {
  const offers = await Offer.find().lean();
  return offers.map(({ _id, ...offer }) => offer);
}

async function getOffers(req, res) {
  const now = new Date();
  const offers = (await readOffers()).filter(offer => offer.status === 'live' && new Date(offer.expiresAt) > now);
  res.json({ success: true, data: { offers, count: offers.length } });
}

async function createOffer(req, res) {
  const discount = Number(req.body.discount);
  const { duration, targetVibe } = req.body;
  if (!Number.isInteger(discount) || discount < 1 || discount > 100) return res.status(400).json({ success: false, message: 'Discount must be between 1 and 100' });
  if (!allowedDurations.has(duration)) return res.status(400).json({ success: false, message: 'Duration is invalid.' });
  if (typeof targetVibe !== 'string' || !allowedVibes.has(targetVibe.trim())) return res.status(400).json({ success: false, message: 'Target vibe is invalid.' });
  const createdAt = new Date();
  const offer = {
    id: `OFF-${Date.now().toString(36).toUpperCase()}`,
    discount,
    duration,
    targetVibe: targetVibe.trim(),
    status: 'live',
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + allowedDurations.get(duration) * 60 * 60 * 1000).toISOString(),
    merchantId: Number(req.user.id)
  };
  const savedOffer = await Offer.create(offer);
  const { _id, ...responseOffer } = savedOffer.toObject();
  res.status(201).json({ success: true, data: { offer: responseOffer } });
}

async function deleteOffer(req, res) {
  const deletedOffer = await Offer.findOneAndDelete({ id: req.params.id, merchantId: Number(req.user.id) }).lean();
  if (!deletedOffer) return res.status(404).json({ success: false, message: 'Offer not found.' });
  const { _id, ...offer } = deletedOffer;
  res.json({ success: true, data: { offer, offers: await readOffers() } });
}

module.exports = { getOffers, createOffer, deleteOffer, readOffers };
