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

    res.json({ success_url: session.url, email, items, amount: session.amount_total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/success', async (req, res) => {
  try {
    const { email, items, amount } = req.query;
    // Parse the amount parameter as an integer
    const amountInCents = parseInt(amount);

    // After a successful Stripe purchase, send the order summary email
    await sendOrderSummaryEmail(email, items, amountInCents);

    // Redirect the user to a success page
    res.redirect(`${process.env.FRONTEND_URL}/success`);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
