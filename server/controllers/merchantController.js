const { getPublicExperiences, applyOffers } = require('./experienceController');

async function getMerchantExperiences(req, res) {
  const merchantId = Number(req.user.id);
  const offers = await req.app.locals.readOffers();
  const experiences = applyOffers(await getPublicExperiences(), offers)
    .filter(experience => Number(experience.merchantId) === merchantId)
    .map(experience => ({ ...experience, merchantId }));

  res.json({ success: true, data: { experiences, count: experiences.length } });
}

async function getAnalytics(req, res) {
  const now = new Date();
  const offers = await req.app.locals.readOffers();
  const activeOffers = offers.filter(offer => offer.status === 'live' && new Date(offer.expiresAt) > now).length;
  res.json({
    success: true,
    data: { analytics: { nearbyTravelers: 186, potentialVisitors: 64, activeOffers } }
  });
}

module.exports = { getAnalytics, getMerchantExperiences };
