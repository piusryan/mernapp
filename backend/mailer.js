const sgMail = require('@sendgrid/mail')

function getTransport() {
  if (process.env.SMTP_DISABLE === '1') return null
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    console.warn('[mail] SENDGRID_API_KEY is missing')
    return null
  }
  sgMail.setApiKey(apiKey)
  return sgMail
}

async function sendOtpEmail(to, otp) {
  const mailer = getTransport()
  if (!mailer) {
    console.log(`[mail] Disabled/Missing Key. OTP for ${to}: ${otp}`)
    return
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER // Fallback, but SendGrid needs a verified sender
  if (!from) {
    console.error('[mail] EMAIL_FROM env var is missing (required for SendGrid)')
    return
  }

  const msg = {
    to,
    from,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your OTP is <b>${otp}</b>.</p><p>It expires in 10 minutes.</p>`,
  }

  try {
    await mailer.send(msg)
    console.log(`[mail] Sent OTP to ${to}`)
  } catch (error) {
    console.error('[mail] SendGrid OTP Error:', error)
    if (error.response) {
      console.error(error.response.body)
    }
  }
}

function formatItems(items) {
  return items.map(i => `• ${i.name} × ${i.quantity} — ₹${i.price * i.quantity}`).join('\n')
}

async function sendOrderEmail(to, order, mode) {
  const mailer = getTransport()
  const isUpdate = mode && mode !== 'confirmed'
  const subject = isUpdate ? `Your order ${order._id} is ${mode}` : `Order confirmation ${order._id}`
  const intro = isUpdate ? `Good news! Your order is now ${mode}.` : `Thanks for your purchase! We've received your order.`
  
  if (!mailer) {
    console.log(`[mail] Disabled/Missing Key. Order email for ${to}`)
    return
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER
  if (!from) {
    console.error('[mail] EMAIL_FROM env var is missing')
    return
  }

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

  const msg = {
    to,
    from,
    subject,
    text,
    html,
  }

  try {
    await mailer.send(msg)
    console.log(`[mail] Sent Order email to ${to}`)
  } catch (error) {
    console.error('[mail] SendGrid Order Error:', error)
    if (error.response) {
      console.error(error.response.body)
    }
  }
}

module.exports = { sendOtpEmail, sendOrderEmail }
