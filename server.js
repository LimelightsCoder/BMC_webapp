require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

app.use(cors({
  origin: 'http://localhost:5173',
}));

app.use(express.json());

const storeItems = new Map([
  [1, { priceInCents: 3000, name: 'Improve 101 - Bundle' }],
  [2, { priceInCents: 1000, name: 'Single Class Improv' }],
]);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'coryrp53@gmail.com',
    pass: "bzwotvadwryftehb",
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
      success_url: `${process.env.SERVER_URL}/success?email=${email}&items=${items.map(item => item.id).join(',')}&amount={CHECKOUT_SESSION_AMOUNT}`,
      cancel_url: `${process.env.SERVER_URL}/registration`,
    });

    // After a successful Stripe purchase, send the order summary email
    await sendOrderSummaryEmail(email, items, session.amount_total);

    const updatedSuccessUrl = session.success_url.replace('{CHECKOUT_SESSION_AMOUNT}', session.amount_total);
    session.success_url = updatedSuccessUrl;

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const buildPath = path.join(__dirname, '../client/bmc_webapp/dist');
app.use(express.static(buildPath));

app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.jsx')) {
    res.type('text/javascript');
  }
  next();
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/bmc_webapp/dist/index.html'));
});

app.get('/registration', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/bmc_webapp/dist/index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/bmc_webapp/dist/index.html'));
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
