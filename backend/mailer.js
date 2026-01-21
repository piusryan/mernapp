const { Resend } = require('resend')

let resendClient = null

function getResend() {
  if (resendClient) return resendClient
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[mail] RESEND_API_KEY is missing')
    return null
  }
  resendClient = new Resend(key)
  return resendClient
}

async function sendOtpEmail(to, otp) {
  const resend = getResend()
  if (!resend) {
    console.log(`[mail] Resend Disabled. OTP for ${to}: ${otp}`)
    return
  }

  // Resend requires a verified domain or "onboarding@resend.dev" if testing
  // We use the env var or default to the test email for now
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: 'Your OTP Code',
      html: `<p>Your OTP is <b>${otp}</b>.</p><p>It expires in 10 minutes.</p>`
    })

    if (error) {
      console.error('[mail] Resend OTP Error:', error)
      return
    }
    console.log(`[mail] Sent OTP to ${to} (ID: ${data.id})`)
  } catch (err) {
    console.error('[mail] Resend Exception:', err)
  }
}

function formatItems(items) {
  return items.map(i => `• ${i.name} × ${i.quantity} — ₹${i.price * i.quantity}`).join('\n')
}

async function sendOrderEmail(to, order, mode) {
  const resend = getResend()
  const isUpdate = mode && mode !== 'confirmed'
  const subject = isUpdate ? `Your order ${order._id} is ${mode}` : `Order confirmation ${order._id}`
  const intro = isUpdate ? `Good news! Your order is now ${mode}.` : `Thanks for your purchase! We've received your order.`
  
  if (!resend) {
    console.log(`[mail] Resend Disabled. Order email for ${to}`)
    return
  }

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'

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

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html
    })

    if (error) {
      console.error('[mail] Resend Order Error:', error)
      return
    }
    console.log(`[mail] Sent Order email to ${to} (ID: ${data.id})`)
  } catch (err) {
    console.error('[mail] Resend Exception:', err)
  }
}

module.exports = { sendOtpEmail, sendOrderEmail }
