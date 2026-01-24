require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

(async function() {
  console.log('--- Email Test Start ---');
  console.log('API Key:', process.env.RESEND_API_KEY ? 'Present' : 'Missing');
  console.log('From Address:', process.env.EMAIL_FROM);
  
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM, // Using the custom domain
      to: 'yoy181099+test@gmail.com', // Sending to an alias to test "other user" behavior
      subject: 'Test Email from MERN App',
      html: '<p>If you see this, your Domain and API Key are working perfectly!</p>'
    });

    if (error) {
      console.error('FAILED. Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('SUCCESS! Email Sent. ID:', data.id);
    }
  } catch (err) {
    console.error('CRASHED:', err);
  }
})();
