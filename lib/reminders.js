const { sendMail, wrap, escapeHtml } = require('./util');

// One email at <=72h left, one at <=24h left, per bookmark. Never duplicates.
async function sendIfDue(db, b, now = Date.now()) {
  const hoursLeft = (new Date(b.deadline).getTime() - now) / 3600000;
  if (hoursLeft <= 0) return false;

  const stage = hoursLeft <= 24 ? 24 : hoursLeft <= 72 ? 72 : null;
  const before = b.sent || [];
  if (!stage || before.includes(stage)) return false;

  // "Claim" the stage first so two overlapping runs can't both send it
  const claim = await db.collection('bookmarks').updateOne(
    { _id: b._id, sent: { $ne: stage } },
    { $addToSet: { sent: { $each: stage === 24 ? [24, 72] : [72] } } }
  );
  if (!claim.modifiedCount) return false;

  const when = new Date(b.deadline).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  const left = hoursLeft < 24 ? `${Math.max(1, Math.round(hoursLeft))} hour(s)` : `${Math.round(hoursLeft / 24)} day(s)`;

  try {
    await sendMail(b.email, `Deadline in ${left}: ${b.title}`, wrap(`
      <p>The deadline for an opportunity you saved is close:</p>
      <h3 style="margin:8px 0;color:#1e1b3a">${escapeHtml(b.title)}</h3>
      <p><b>Deadline:</b> ${when} IST<br><b>Time left:</b> ~${left}</p>
      ${b.url ? `<p><a href="${encodeURI(b.url)}" style="background:#6654e8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Apply now</a></p>` : ''}`));
    return true;
  } catch (e) {
    // email failed: undo the claim so the next run retries
    await db.collection('bookmarks').updateOne({ _id: b._id }, { $set: { sent: before } });
    throw e;
  }
}

module.exports = { sendIfDue };
