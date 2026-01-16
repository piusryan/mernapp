const nodemailer = require('nodemailer')

function buildTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || (host ? 587 : 0))
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  const user = process.env.SMTP_USER || 'yoy181099@gmail.com'
  const pass = process.env.SMTP_PASS

  if (process.env.SMTP_DISABLE === '1') {
    return null
  }

  if (host) {
    return nodemailer.createTransport({
      host,
      port: port || 587,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    })
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: user && pass ? { user, pass } : undefined,
  })
}

async function sendOtpEmail(to, otp) {
  const transport = buildTransport()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'yoy181099@gmail.com'
  const subject = 'Your OTP Code'
  const text = `Your OTP is ${otp}. It expires in 10 minutes.`
  const html = `<p>Your OTP is <b>${otp}</b>.</p><p>It expires in 10 minutes.</p>`

  if (!transport) {
    console.log(`[mail] SMTP disabled — would send to ${to}: ${otp}`)
    return
  }

  try {
    await transport.sendMail({ from, to, subject, text, html })
    console.log(`[mail] Sent OTP to ${to}`)
  } catch (e) {
    console.error('[mail] Failed to send OTP', e && e.message ? e.message : e)
    throw e
  }
}

module.exports = { sendOtpEmail }
 
function formatItems(items) {
  return items.map(i => `• ${i.name} × ${i.quantity} — ₹${i.price * i.quantity}`).join('\n')
}

async function sendOrderEmail(to, order, mode) {
  const transport = buildTransport()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'yoy181099@gmail.com'
  const isUpdate = mode && mode !== 'confirmed'
  const subject = isUpdate ? `Your order ${order._id} is ${mode}` : `Order confirmation ${order._id}`
  const intro = isUpdate ? `Good news! Your order is now ${mode}.` : `Thanks for your purchase! We've received your order.`
  const text = `${intro}

Order: ${order._id}
Placed by: ${order.username}
Date: ${new Date(order.createdAt).toLocaleString()}

Items:
${formatItems(order.items)}

Total: ₹${order.totalAmount}
`
  const html = `<div>
  <p>${intro}</p>
  <p><b>Order:</b> ${order._id}</p>
  <p><b>Placed by:</b> ${order.username}</p>
  <p><b>Date:</b> ${new Date(order.createdAt).toLocaleString()}</p>
  <p><b>Items:</b></p>
  <ul>
    ${order.items.map(i => `<li>${i.name} × ${i.quantity} — ₹${i.price * i.quantity}</li>`).join('')}
  </ul>
  <p style="font-weight:700">Total: ₹${order.totalAmount}</p>
</div>`

  if (!transport) {
    console.log(`[mail] SMTP disabled — would send ${isUpdate?'status update':'confirmation'} to ${to} for order ${order._id}`)
    return
  }
  try {
    await transport.sendMail({ from, to, subject, text, html })
    console.log(`[mail] Sent ${isUpdate?'status update':'confirmation'} to ${to} for order ${order._id}`)
  } catch (e) {
    console.error('[mail] Failed to send order email', e && e.message ? e.message : e)
    throw e
  }
}

module.exports.sendOrderEmail = sendOrderEmail

