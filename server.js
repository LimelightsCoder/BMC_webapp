require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

app.use(cors({
  origin: "https://bmcimprov.netlify.app",
}));

app.use(express.json());

const storeItems = new Map([
  [1, { priceInCents: 3000, name: 'Improv 101 - Bundle' }],
  [2, { priceInCents: 1000, name: 'Single Class Improv' }],
]);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'coryrp53@gmail.com',
    pass: 'bzwotvadwryftehb',
  },
});

async function sendOrderSummaryEmail(email, items, amount) {
  const emailBody = `
    Thank you for your order!

    Order Summary:
    --------------
    Items: ${items.join(', ')}
    Total Amount: $${amount / 100}
  `;

  await transporter.sendMail({
    from: 'coryrp53@gmail.com',
    to: email,
    subject: 'BMC Improv: Order Summary',
    text: emailBody,
  });
}

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, items } = req.body;
    const lineItems = items.map(item => {
      const storeItem = storeItems.get(item.id);
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: storeItem.name,
          },
          unit_amount: storeItem.priceInCents,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${process.env.FRONTEND_URL}/success?email=${email}&items=${items.map(item => item.id).join(',')}&amount={CHECKOUT_SESSION_AMOUNT}`,
      cancel_url: `${process.env.FRONTEND_URL}/registration`,
    });

    // After a successful Stripe purchase, send the order summary email
    await sendOrderSummaryEmail(email, items, session.amount_total);

    // const updatedSuccessUrl = session.success_url.replace('{CHECKOUT_SESSION_AMOUNT}', session.amount_total);
    // session.success_url = updatedSuccessUrl;

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// // Serve frontend files
// const buildPath = path.join(__dirname, '../client/dist');
// app.use(express.static(buildPath));

// // Route handler for all requests
// app.get('*', (req, res) => {
//   res.sendFile(path.join(buildPath, 'index.html'));
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
