const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { sendOtpEmail, sendOrderEmail } = require('./mailer');
const Stripe = require('stripe');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: (origin, callback) => {
    const allowed = FRONTEND_ORIGIN.split(',').map(o => o.trim());
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false
}));
app.use(express.json());

// Helper to resolve asset paths (checks current dir first, then parent)
const getAssetPath = (...segments) => {
  const localPath = path.join(__dirname, ...segments);
  if (fs.existsSync(localPath)) return localPath;
  return path.join(__dirname, '..', ...segments);
};

app.use('/images', express.static(getAssetPath('imaages')));
app.use('/offerimages', express.static(getAssetPath('offerimages')));
app.get('/site-assets/plain.jpg', (req, res) => {
  res.sendFile(getAssetPath('plain.jpg'))
});
app.get('/site-assets/AJ.png', (req, res) => {
  res.sendFile(getAssetPath('AJ.png'))
});

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error', err));

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['admin', 'customer'], default: 'customer' },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String },
    otpCode: { type: String },
    otpExpires: { type: Date },
    cookiesAccepted: { type: Boolean, default: false },
    cookiesAcceptedAt: { type: Date },
    location: {
      lat: { type: Number },
      lon: { type: Number },
    },
    locationAcc: { type: Number },
    landmark: { type: String, default: '' },
    locationPoint: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }
    },
    locationSource: { type: String, enum: ['GPS', 'IP'], default: 'IP' },
    address: { type: String, default: '' },
  },
  { timestamps: true }
);

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, enum: ['raw', 'processed'], required: true },
    imagePath: { type: String },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    grams: { type: Number, default: 0, min: 0 },
    pieces: { type: Number, default: 0, min: 0 },
    serves: { type: Number, default: 0, min: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    stockStatus: { type: String, enum: ['available','limited','outofstock'], default: 'available' },
  },
  { timestamps: true }
);

const cartItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    items: { type: [cartItemSchema], default: [] },
    totalAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    appliedCoupon: { type: String, default: '' },
    status: { type: String, enum: ['confirmed', 'shipped', 'delivered', 'cancelled'], default: 'confirmed' },
    trackingNumber: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [
      new mongoose.Schema({
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        imagePath: { type: String }
      }, { _id: false })
    ], default: [] }
  },
  { timestamps: true }
);

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    maxUses: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    minOrderAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Cart = mongoose.model('Cart', cartSchema);
const Wishlist = mongoose.model('Wishlist', wishlistSchema);
const Order = mongoose.model('Order', orderSchema);
const Coupon = mongoose.model('Coupon', couponSchema);
const reviewSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 1000 },
    approved: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Review = mongoose.model('Review', reviewSchema);
const orderStatusSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    status: { type: String, required: true },
    message: { type: String, default: '' },
    updatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
)
const OrderStatusHistory = mongoose.model('OrderStatusHistory', orderStatusSchema)

function toName(file) {
  return file
    .replace(/\.[^/.]+$/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ') 
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function importItemsFromImages() {
  const base = path.join(__dirname, '..', 'imaages');
  const rawDir = path.join(base, 'rawmeat');
  const processedDir = path.join(base, 'processsedfood');

  const entries = [];
  function priceFor(category, file) {
    const f = file.toLowerCase();
    if (category === 'raw') {
      if (f.includes('egg')) return 99;
      if (f.includes('prawn')) return 229;
      if (f.includes('mackerel')) return 279;
      if (f.includes('pomfret')) return 289;
      if (f.includes('broiler')) return 199;
      if (f.includes('breast')) return 199;
      if (f.includes('frozen') || f.includes('marinated')) return 249;
      return 299;
    } else {
      if (f.includes('chicken_salami')) return 199;
      if (f.includes('pickle')) return 149;
      if (f.includes('spice')) return 149;
      return 199;
    }
  }
  if (fs.existsSync(rawDir)) {
    for (const f of fs.readdirSync(rawDir)) {
      const fp = `/images/rawmeat/${f}`;
      entries.push({ name: toName(f), price: priceFor('raw', f), category: 'raw', imagePath: fp });
    }
  }
  if (fs.existsSync(processedDir)) {
    for (const f of fs.readdirSync(processedDir)) {
      const fp = `/images/processsedfood/${f}`;
      entries.push({ name: toName(f), price: priceFor('processed', f), category: 'processed', imagePath: fp });
    }
  }
  if (entries.length) {
    for (const e of entries) {
      const existing = await Item.findOne({ name: e.name });
      if (!existing) await Item.create(e);
    }
    console.log(`Imported ${entries.length} items from images`);
  }
}

importItemsFromImages().catch((e) => console.error(e));

async function backfillOrderUsernames() {
  const orders = await Order.find({ $or: [{ username: { $exists: false } }, { username: null }] })
  for (const ord of orders) {
    const user = await User.findById(ord.userId)
    if (user) {
      ord.username = user.username
      await ord.save()
    }
  }
  if (orders.length) console.log(`Backfilled ${orders.length} orders with username`)
}

backfillOrderUsernames().catch((e) => console.error(e));

async function ensureAdminUser() {
  const adminName = 'AJadmin';
  let admin = await User.findOne({ username: adminName });
  if (!admin) {
    const passwordHash = await bcrypt.hash('AJadmin', 10);
    admin = await User.create({ username: adminName, email: 'ajadmin@example.com', role: 'admin', emailVerified: true, passwordHash });
    console.log('Seeded admin user AJadmin');
  }
}

ensureAdminUser().catch((e) => console.error(e));

function createToken(user) {
  return jwt.sign({ sub: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
}

function generateTracking() {
  const now = new Date()
  const y = now.getFullYear()
  const rand = Math.floor(100000 + Math.random() * 900000)
  const sfx = Math.random().toString(36).slice(2, 4).toUpperCase()
  return `ORD-${y}-${rand}${sfx}`
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userRole = payload.role;
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Food ordering API running' });
});

app.get('/api/offerimages', (req, res) => {
  try {
    const dir = path.join(__dirname, '..', 'offerimages')
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
    const imgs = files.filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f)).map(f => `/offerimages/${f}`)
    res.json(imgs)
  } catch (e) {
    res.status(500).json({ error: 'Failed to list images' })
  }
});

app.post('/api/auth/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRx.test(email)) return res.status(400).json({ error: 'Valid email required' });
    let user = await User.findOne({ email });
    if (user && user.emailVerified) return res.status(409).json({ error: 'Email already registered' });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    if (!user) {
      user = await User.create({ username: email, email, role: 'customer', emailVerified: false, otpCode: otp, otpExpires: expires });
    } else {
      user.username = email;
      user.otpCode = otp;
      user.otpExpires = expires;
      await user.save();
    }
    try {
      await sendOtpEmail(email, otp);
    } catch (err) {
      console.error('Email send failed, OTP logged to server console');
      console.log(`OTP for ${email}: ${otp}`);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'OTP request failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRx.test(email)) return res.status(400).json({ error: 'Valid email required' });
    if (!password || !otp) return res.status(400).json({ error: 'Password and OTP required' });
    const user = await User.findOne({ email });
    if (!user || !user.otpCode) return res.status(404).json({ error: 'Request OTP first' });
    if (user.otpCode !== otp || !user.otpExpires || user.otpExpires < new Date()) return res.status(400).json({ error: 'Invalid or expired OTP' });
    user.passwordHash = await bcrypt.hash(password, 10);
    user.emailVerified = true;
    user.username = email;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();
    const token = createToken(user);
    res.status(201).json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    let user = null;
    if (username) user = await User.findOne({ username });
    else if (email) user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.role !== 'admin' && !user.emailVerified) return res.status(403).json({ error: 'Email not verified' });
    const token = createToken(user);
    res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      email: user.email,
      cookiesAccepted: Boolean(user.cookiesAccepted),
      landmark: user.landmark || '',
      location: user.location || null
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (email) {
      const existing = await User.findOne({ email });
      if (existing && String(existing._id) !== String(user._id)) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      user.email = email;
    }

    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();
    res.json({ ok: true, user: { id: user._id, username: user.username, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    const { q, category } = req.query || {}
    const cond = {}
    if (q) cond.name = { $regex: String(q), $options: 'i' }
    if (category && ['raw', 'processed'].includes(String(category))) cond.category = String(category)
    const items = await Item.find(cond).sort({ name: 1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/api/cart/add', authMiddleware, async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    if (!itemId || !quantity || quantity < 1) return res.status(400).json({ error: 'itemId and quantity required' });
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.stockStatus === 'outofstock') return res.status(409).json({ error: 'Item out of stock' });

    let cart = await Cart.findOne({ userId: req.userId });
    if (!cart) cart = await Cart.create({ userId: req.userId, items: [] });

    const idx = cart.items.findIndex((ci) => String(ci.itemId) === String(item._id));
    if (idx >= 0) {
      cart.items[idx].quantity += quantity;
    } else {
      cart.items.push({ itemId: item._id, name: item.name, price: item.price, quantity });
    }
    await cart.save();
    res.json(cart);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

app.get('/api/cart', authMiddleware, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.userId });
    if (!cart) cart = await Cart.create({ userId: req.userId, items: [] });
    res.json(cart);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/api/cart/remove', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    let cart = await Cart.findOne({ userId: req.userId });
    if (!cart) cart = await Cart.create({ userId: req.userId, items: [] });
    const prevLen = cart.items.length;
    cart.items = cart.items.filter((ci) => String(ci.itemId) !== String(itemId));
    if (cart.items.length === prevLen) return res.status(404).json({ error: 'Item not in cart' });
    await cart.save();
    res.json(cart);
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

app.get('/api/wishlist', authMiddleware, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ userId: req.userId });
    if (!wishlist) wishlist = await Wishlist.create({ userId: req.userId, items: [] });
    res.json(wishlist);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

app.post('/api/wishlist/toggle', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    let wishlist = await Wishlist.findOne({ userId: req.userId });
    if (!wishlist) wishlist = await Wishlist.create({ userId: req.userId, items: [] });

    const idx = wishlist.items.findIndex(i => String(i.itemId) === String(itemId));
    if (idx >= 0) {
      wishlist.items.splice(idx, 1);
    } else {
      wishlist.items.push({ itemId: item._id, name: item.name, price: item.price, imagePath: item.imagePath });
    }
    await wishlist.save();
    res.json(wishlist);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update wishlist' });
  }
});

app.post('/api/create-payment-intent', authMiddleware, async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ error: 'Stripe key missing' });
    const stripe = Stripe(stripeKey);
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    const totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: 'inr',
      automatic_payment_methods: { enabled: true },
      metadata: { userId: String(req.userId) }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error('Stripe Intent Error:', e);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

app.post('/api/cart/checkout', authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    const totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const user = await User.findById(req.userId)
    let tracking = ''
    for (let tries = 0; tries < 3; tries++) {
      const t = generateTracking()
      const exists = await Order.findOne({ trackingNumber: t })
      if (!exists) { tracking = t; break }
    }
    const order = await Order.create({ userId: req.userId, username: user ? user.username : 'unknown', items: cart.items, totalAmount, status: 'confirmed', trackingNumber: tracking });
    cart.items = [];
    await cart.save();
    try {
      await OrderStatusHistory.create({ orderId: order._id, status: 'placed', message: 'Order placed', updatedBy: 'system' })
      await OrderStatusHistory.create({ orderId: order._id, status: 'confirmed', message: 'Payment confirmed', updatedBy: 'system' })
    } catch {}
    try {
      if (user && user.email) {
        await sendOrderEmail(user.email, order, 'confirmed')
      }
    } catch (e) {
      console.error('Order confirmation email failed', e && e.message ? e.message : e)
    }
    res.json({ orderId: order._id, username: order.username, totalAmount, items: order.items, createdAt: order.createdAt });
  } catch (e) {
    res.status(500).json({ error: 'Checkout failed' });
  }
});

app.post('/api/admin/reset-and-import', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const wipeUsers = Boolean(req.body && req.body.wipeUsers);
    await Promise.all([Cart.deleteMany({}), Order.deleteMany({}), Item.deleteMany({})]);
    if (wipeUsers) await User.deleteMany({});
    await importItemsFromImages();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

app.get('/api/orders/latest', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    if (!order) return res.status(404).json({ error: 'No orders' });
    const { _id, userId, username, items, totalAmount, status, createdAt, updatedAt } = order
    res.json({ _id, userId, username, items, totalAmount, status, createdAt, updatedAt });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/admin/orders/recent', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const q = req.query || {};
    const rawLimit = q.limit != null ? Number(q.limit) : 10;
    const limit = Math.max(1, Math.min(50, Number.isNaN(rawLimit) ? 10 : rawLimit));
    const orders = await Order.find({}).sort({ createdAt: -1 }).limit(limit);
    const ids = orders.map(o => o._id);
    const history = await OrderStatusHistory.find({ orderId: { $in: ids } }).sort({ createdAt: -1 });
    const lastByOrder = new Map();
    for (const h of history) {
      const key = String(h.orderId);
      if (!lastByOrder.has(key)) lastByOrder.set(key, h);
    }
    const result = orders.map(o => {
      const h = lastByOrder.get(String(o._id));
      return {
        id: o._id,
        trackingNumber: o.trackingNumber || '',
        username: o.username || '',
        totalAmount: o.totalAmount || 0,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        lastMessage: h ? h.message : '',
        lastStatus: h ? h.status : o.status,
        lastUpdatedAt: h ? h.createdAt : o.updatedAt
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

app.get('/api/recommendations', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId })
    const counts = { raw: 0, processed: 0 }
    for (const o of orders) {
      for (const it of o.items) {
        // find item category by name reference (fallback when id not available in embedded doc)
        const found = await Item.findOne({ name: it.name })
        if (found && (found.category === 'raw' || found.category === 'processed')) {
          counts[found.category] += it.quantity || 1
        }
      }
    }
    let pickCat = null
    if (counts.raw > counts.processed) pickCat = 'raw'
    else if (counts.processed > counts.raw) pickCat = 'processed'
    let items = []
    if (pickCat) {
      items = await Item.find({ category: pickCat }).sort({ ratingAvg: -1, name: 1 }).limit(8)
    } else {
      items = await Item.find({}).sort({ ratingAvg: -1, name: 1 }).limit(8)
    }
    res.json(items)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch recommendations' })
  }
})
// Reviews & Ratings
const bannedWords = ['badword', 'damn', 'shit', 'fuck']

app.get('/api/items/:id/reviews', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const reviews = await Review.find({ itemId: item._id, approved: true }).sort({ createdAt: -1 })
    res.json({ ratingAvg: item.ratingAvg, ratingCount: item.ratingCount, reviews })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

app.post('/api/reviews', authMiddleware, async (req, res) => {
  try {
    const { itemId, rating, comment } = req.body || {}
    if (!itemId || !rating) return res.status(400).json({ error: 'itemId and rating required' })
    const item = await Item.findById(itemId)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const user = await User.findById(req.userId)
    const text = String(comment || '')
    const lower = text.toLowerCase()
    const hasBad = bannedWords.some(w => lower.includes(w))
    const approved = !hasBad
    const review = await Review.create({ itemId: item._id, userId: req.userId, username: user ? user.username : 'unknown', rating: Math.max(1, Math.min(5, Number(rating))), comment: text, approved })
    if (approved) {
      const newCount = (item.ratingCount || 0) + 1
      const newAvg = (((item.ratingAvg || 0) * (item.ratingCount || 0)) + review.rating) / newCount
      item.ratingAvg = Number(newAvg.toFixed(2))
      item.ratingCount = newCount
      await item.save()
    }
    res.status(201).json({ ok: true, approved })
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit review' })
  }
})

app.get('/api/admin/reviews/pending', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const pending = await Review.find({ approved: false }).sort({ createdAt: -1 })
    res.json(pending)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch pending reviews' })
  }
})

app.post('/api/admin/reviews/:id/moderate', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const { action } = req.body || {}
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (action === 'approve') {
      if (!review.approved) {
        review.approved = true
        await review.save()
        const item = await Item.findById(review.itemId)
        if (item) {
          const newCount = (item.ratingCount || 0) + 1
          const newAvg = (((item.ratingAvg || 0) * (item.ratingCount || 0)) + review.rating) / newCount
          item.ratingAvg = Number(newAvg.toFixed(2))
          item.ratingCount = newCount
          await item.save()
        }
      }
      res.json({ ok: true })
    } else if (action === 'reject') {
      await Review.deleteOne({ _id: review._id })
      res.json({ ok: true })
    } else {
      res.status(400).json({ error: 'Invalid action' })
    }
  } catch (e) {
    res.status(500).json({ error: 'Moderation failed' })
  }
})
 
app.delete('/api/admin/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ error: 'Review not found' })
    const item = await Item.findById(review.itemId)
    if (item && review.approved) {
      const currentCount = item.ratingCount || 0
      const currentAvg = item.ratingAvg || 0
      const newCount = Math.max(0, currentCount - 1)
      const newAvg = newCount > 0 ? (((currentAvg * currentCount) - review.rating) / newCount) : 0
      item.ratingCount = newCount
      item.ratingAvg = Number(newAvg.toFixed(2))
      await item.save()
    }
    await Review.deleteOne({ _id: review._id })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Delete review failed' })
  }
})

// File Upload Configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/admin/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const filename = 'upload-' + Date.now() + path.extname(req.file.originalname);
    
    // 1. ALWAYS Save locally first (Optimistic UI / Temporary Availability)
    // This ensures the image is available immediately on the current server instance.
    const dir = path.join(__dirname, 'imaages', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const localSavePath = path.join(dir, filename);
    fs.writeFileSync(localSavePath, req.file.buffer);
    
    const localUrl = `/images/uploads/${filename}`;

    // 2. Cloudinary Strategy (Best: Instant & Permanent)
    if (process.env.CLOUDINARY_URL) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'mernapp_uploads' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        // Return the secure URL from Cloudinary
        res.json({ path: result.secure_url, method: 'cloudinary' });
      } catch (err) {
        console.error('Cloudinary Upload Error:', err);
        // Fallback to local URL if Cloudinary fails
        res.json({ path: localUrl, method: 'local_fallback' });
      }
    }
    // 3. GitHub Strategy (Hybrid: Immediate Local + Background Permanent)
    else if (process.env.GITHUB_TOKEN) {
      // Return the local URL immediately so the user sees the image NOW.
      res.json({ path: localUrl, method: 'github_hybrid' });

      // Trigger GitHub upload in background (Fire-and-Forget)
      // This will trigger a redeploy. When the new server starts ~5 mins later,
      // the image will be part of the repo and served from the same path.
      (async () => {
        try {
          console.log(`[Background] Starting GitHub upload for ${filename}...`);
          const rawToken = process.env.GITHUB_TOKEN.trim();
          const token = rawToken.replace(/^["']|["']$/g, '');
          const owner = 'piusryan';
          const repo = 'mernapp';
          const filePath = `backend/imaages/uploads/${filename}`;
          const content = req.file.buffer.toString('base64');
          
          const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'MernApp-Admin'
            },
            body: JSON.stringify({
              message: `upload: ${filename}`,
              content: content,
              branch: 'main'
            })
          });

          if (!ghRes.ok) {
            const err = await ghRes.json();
            console.error('[Background] GitHub Upload Failed:', err);
          } else {
            console.log(`[Background] GitHub Upload Success for ${filename}. Redeploy triggered.`);
          }
        } catch (err) {
          console.error('[Background] GitHub Upload Exception:', err);
        }
      })();
    } 
    // 4. Local Only (Dev Mode)
    else {
      res.json({ path: localUrl, method: 'local' });
    }
  } catch (e) {
    console.error('Upload failed', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/admin/items', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const { name, price, category, imagePath, description, grams, pieces, serves, stockStatus } = req.body || {}
    const n = String(name || `New Item ${Math.floor(Math.random()*1000)}`)
    const p = Number(price || (100 + Math.floor(Math.random()*250)))
    const c = ['raw', 'processed'].includes(String(category)) ? String(category) : 'raw'
    const s = ['available','limited','outofstock'].includes(String(stockStatus)) ? String(stockStatus) : 'available'
    const img = imagePath || ''
    let finalImg = ''
    if (img) {
      if (/^https?:\/\//i.test(img)) {
        finalImg = img
      } else {
        const normalized = String(img).replace(/\\/g, '/')
        const lower = normalized.toLowerCase()
        const mark = '/imaages/'
        const idx = lower.indexOf(mark)
        if (idx >= 0) {
          const rel = normalized.substring(idx + mark.length)
          finalImg = `/images/${rel}`
        } else if (lower.startsWith('/images/')) {
          finalImg = normalized
        } else {
          finalImg = `/images/${normalized.replace(/^\/+/, '')}`
        }
      }
    }
    if (!n || !p) return res.status(400).json({ error: 'name and price required' })
    const exists = await Item.findOne({ name: n })
    if (exists) return res.status(409).json({ error: 'Item already exists' })
    const item = await Item.create({
      name: n,
      price: p,
      category: c,
      stockStatus: s,
      imagePath: finalImg,
      description: String(description || ''),
      grams: grams != null ? Math.max(0, Number(grams)) : 0,
      pieces: pieces != null ? Math.max(0, Number(pieces)) : 0,
      serves: serves != null ? Math.max(0, Number(serves)) : 0
    })
    res.status(201).json(item)
  } catch (e) {
    res.status(500).json({ error: 'Create item failed' })
  }
})

// Live Cart Spy Endpoint - Re-verified
app.get('/api/admin/carts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Find carts that have items
    const carts = await Cart.find({ 'items.0': { $exists: true } })
      .populate('userId', 'username email')
      .sort({ updatedAt: -1 });
    res.json(carts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch active carts' });
  }
});

app.put('/api/admin/items/:id', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const { name, price, category, imagePath, description, grams, pieces, serves, stockStatus } = req.body || {}
    const item = await Item.findById(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const n = name != null ? String(name) : item.name
    const p = price != null ? Number(price) : item.price
    const c = category != null && ['raw','processed'].includes(String(category)) ? String(category) : item.category
    const s = stockStatus != null && ['available','limited','outofstock'].includes(String(stockStatus)) ? String(stockStatus) : item.stockStatus
    let finalImg = item.imagePath || ''
    if (imagePath != null) {
      const img = String(imagePath)
      if (img) {
        if (/^https?:\/\//i.test(img)) {
          finalImg = img
        } else {
          const normalized = String(img).replace(/\\/g, '/')
          const lower = normalized.toLowerCase()
          const mark = '/imaages/'
          const idx = lower.indexOf(mark)
          if (idx >= 0) {
            const rel = normalized.substring(idx + mark.length)
            finalImg = `/images/${rel}`
          } else if (lower.startsWith('/images/')) {
            finalImg = normalized
          } else {
            finalImg = `/images/${normalized.replace(/^\/+/, '')}`
          }
        }
      } else {
        finalImg = ''
      }
    }
    if (!n || !p) return res.status(400).json({ error: 'name and price required' })
    if (n !== item.name) {
      const exists = await Item.findOne({ name: n })
      if (exists && String(exists._id) !== String(item._id)) return res.status(409).json({ error: 'Item name already exists' })
    }
    item.name = n
    item.price = p
    item.category = c
    item.stockStatus = s
    item.imagePath = finalImg
    item.description = description != null ? String(description) : item.description
    if (grams != null) item.grams = Math.max(0, Number(grams))
    if (pieces != null) item.pieces = Math.max(0, Number(pieces))
    if (serves != null) item.serves = Math.max(0, Number(serves))
    await item.save()
    res.json(item)
  } catch (e) {
    res.status(500).json({ error: 'Update item failed' })
  }
})

app.delete('/api/admin/items/:id', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const item = await Item.findById(req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    await Item.deleteOne({ _id: item._id })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Delete item failed' })
  }
})
// Coupons (Admin)
app.post('/api/admin/coupons', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const { code, type, value, active, maxUses, expiresAt, minOrderAmount } = req.body || {};
    const c = String(code || '').trim().toUpperCase();
    if (!c || !['percentage','fixed'].includes(String(type))) return res.status(400).json({ error: 'code and type required' });
    const exists = await Coupon.findOne({ code: c });
    if (exists) return res.status(409).json({ error: 'Coupon already exists' });
    const coupon = await Coupon.create({
      code: c,
      type: String(type),
      value: Math.max(0, Number(value || 0)),
      active: Boolean(active != null ? active : true),
      maxUses: Math.max(0, Number(maxUses || 0)),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      minOrderAmount: Math.max(0, Number(minOrderAmount || 0)),
    });
    res.status(201).json(coupon);
  } catch (e) {
    res.status(500).json({ error: 'Create coupon failed' })
  }
});
app.get('/api/admin/coupons', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.json(coupons);
  } catch (e) {
    res.status(500).json({ error: 'Fetch coupons failed' })
  }
});
app.put('/api/admin/coupons/:id', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    const { code, type, value, active, maxUses, expiresAt, minOrderAmount } = req.body || {};
    if (code != null) {
      const c = String(code || '').trim().toUpperCase();
      if (!c) return res.status(400).json({ error: 'Invalid code' });
      if (c !== coupon.code) {
        const exists = await Coupon.findOne({ code: c });
        if (exists) return res.status(409).json({ error: 'Coupon code exists' });
        coupon.code = c;
      }
    }
    if (type != null) {
      if (!['percentage','fixed'].includes(String(type))) return res.status(400).json({ error: 'Invalid type' });
      coupon.type = String(type);
    }
    if (value != null) coupon.value = Math.max(0, Number(value));
    if (active != null) coupon.active = Boolean(active);
    if (maxUses != null) coupon.maxUses = Math.max(0, Number(maxUses));
    if (expiresAt != null) coupon.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
    if (minOrderAmount != null) coupon.minOrderAmount = Math.max(0, Number(minOrderAmount));
    await coupon.save();
    res.json(coupon);
  } catch (e) {
    res.status(500).json({ error: 'Update coupon failed' })
  }
});
app.put('/api/admin/orders/:id/status', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const { status, message } = req.body || {}
    const allowed = ['placed','confirmed','packed','shipped','out_for_delivery','delivered','cancelled']
    if (!status || !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    order.status = status
    await order.save()
    try {
      await OrderStatusHistory.create({ orderId: order._id, status, message: String(message||''), updatedBy: me.username })
    } catch {}
    const user = await User.findById(order.userId)
    try {
      if (user && user.email) {
        await sendOrderEmail(user.email, order, status)
      }
    } catch (e) {
      console.error('Order status email failed', e && e.message ? e.message : e)
    }
    res.json({ ok: true, status: order.status })
  } catch (e) {
    res.status(500).json({ error: 'Status update failed' })
  }
})

app.get('/api/orders/track/:tracking', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const tracking = String(req.params.tracking || '')
    if (!tracking) return res.status(400).json({ error: 'Tracking required' })
    let order = null
    if (/^[0-9a-fA-F]{24}$/.test(tracking)) {
      try { order = await Order.findById(tracking) } catch {}
    }
    if (!order) {
      order = await Order.findOne({ trackingNumber: tracking })
    }
    if (!order) return res.status(404).json({ error: 'Order not found' })
    const history = await OrderStatusHistory.find({ orderId: order._id }).sort({ createdAt: 1 })
    const user = await User.findById(order.userId)
    res.json({
      userId: order.userId,
      username: order.username,
      status: order.status,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      items: order.items,
      history: history.map(h => ({ status: h.status, message: h.message, updatedBy: h.updatedBy, createdAt: h.createdAt })),
      userLocation: user && user.location ? { lat: user.location.lat ?? null, lon: user.location.lon ?? null, acc: user.locationAcc ?? null } : null,
      userLandmark: user ? (user.landmark || '') : '',
      userAddress: user ? (user.address || '') : ''
    })
  } catch (e) {
    res.status(500).json({ error: 'Track failed' })
  }
})
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const usersCount = await User.countDocuments({})
    const ordersCount = await Order.countDocuments({})
    const orders = await Order.find({}).sort({ createdAt: -1 })
    let revenue = 0
    const map = new Map()
    const allItems = await Item.find({})
    const nameToCat = new Map(allItems.map(i=>[i.name, i.category]))
    const cat = { raw: 0, processed: 0 }
    const days = []
    const dayMap = new Map()
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      const key = d.toISOString().slice(0,10)
      days.push(key)
      dayMap.set(key, { day: key, orders: 0, revenue: 0, items: {} })
    }
    for (const o of orders) {
      revenue += o.totalAmount || 0
      const dayKey = new Date(o.createdAt).toISOString().slice(0,10)
      const dm = dayMap.get(dayKey)
      if (dm) {
        dm.orders += 1
        dm.revenue += o.totalAmount || 0
        for (const it of o.items) {
          const iname = it.name || 'Unknown'
          dm.items[iname] = (dm.items[iname] || 0) + (it.quantity || 0)
        }
      }
      for (const it of o.items) {
        const key = it.name || String(it.itemId || '')
        const prev = map.get(key) || { name: it.name, qty: 0, revenue: 0 }
        prev.qty += it.quantity || 0
        prev.revenue += (it.price || 0) * (it.quantity || 0)
        map.set(key, prev)
        const catName = nameToCat.get(it.name)
        if (catName === 'raw') cat.raw += it.quantity || 0
        else if (catName === 'processed') cat.processed += it.quantity || 0
      }
    }
    const bestSelling = Array.from(map.values()).sort((a,b)=> b.qty - a.qty || b.revenue - a.revenue).slice(0, 8)
    const timeseries = days.map(d => {
      const data = dayMap.get(d)
      // Convert items map to sorted array
      const sortedItems = Object.entries(data.items)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8) // Top 8 items per day
      return { ...data, items: sortedItems }
    })
    res.json({ usersCount, ordersCount, revenueTotal: revenue, bestSelling, timeseries, category: cat })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// User location & cookies consent
app.post('/api/user/location', authMiddleware, async (req, res) => {
  try {
    const { lat, lon, accuracy, landmark, cookiesAccepted, source } = req.body || {};
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    let latUse = lat != null ? Number(lat) : null
    let lonUse = lon != null ? Number(lon) : null
    let accUse = accuracy != null ? Math.max(0, Number(accuracy)) : null
    let sourceUse = source || 'GPS'
    
    if (latUse == null || lonUse == null) {
      try {
        let ip = ''
        const xf = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').toString()
        if (xf) ip = xf.split(',')[0].trim()
        if (!ip && req.socket && req.socket.remoteAddress) ip = String(req.socket.remoteAddress).replace('::ffff:', '')
        const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json` : 'https://ipapi.co/json'
        const r = await fetch(url)
        const j = await r.json()
        latUse = j && j.latitude != null ? Number(j.latitude) : latUse
        lonUse = j && j.longitude != null ? Number(j.longitude) : lonUse
        accUse = accUse != null ? accUse : 1000
        sourceUse = 'IP'
      } catch {}
    }
    if (latUse != null && lonUse != null) {
      user.location = { lat: latUse, lon: lonUse };
      if (accUse != null) user.locationAcc = accUse
      user.locationPoint = { type: 'Point', coordinates: [lonUse, latUse] }
      user.locationSource = sourceUse
      async function geocode(latv, lonv) {
        try {
          const provider = String(process.env.GEO_PROVIDER || '').toLowerCase()
          const key = process.env.GEO_API_KEY || ''
          if (provider === 'google' && key) {
            const u = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latv},${lonv}&key=${key}`
            const r = await fetch(u)
            const j = await r.json()
            return (j && j.results && j.results[0] && j.results[0].formatted_address) || ''
          } else if (provider === 'geoapify' && key) {
            const u = `https://api.geoapify.com/v1/geocode/reverse?lat=${latv}&lon=${lonv}&apiKey=${key}`
            const r = await fetch(u)
            const j = await r.json()
            return (j && j.features && j.features[0] && j.features[0].properties && j.features[0].properties.formatted) || ''
          } else {
            const u = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latv}&lon=${lonv}`
            const r = await fetch(u)
            const j = await r.json()
            return (j && (j.display_name || (j.address && (j.address.road || j.address.neighbourhood || j.address.suburb || j.address.city || j.address.town)))) || ''
          }
        } catch { return '' }
      }
      const addr = landmark != null && String(landmark).trim() ? String(landmark).trim() : await geocode(latUse, lonUse)
      if (addr) { user.address = addr; user.landmark = addr }
    } else {
      if (landmark != null) user.landmark = String(landmark);
    }
    if (cookiesAccepted) {
      user.cookiesAccepted = true;
      user.cookiesAcceptedAt = new Date();
    }
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Update location failed' })
  }
});
app.get('/api/admin/users/locations', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    
    // Get users with location data
    const users = await User.find({ cookiesAccepted: true, role: 'customer' })
      .select('username location locationAcc locationSource landmark address updatedAt')
      .sort({ updatedAt: -1 });

    // Get active carts to link with users
    const activeCarts = await Cart.find({ 'items.0': { $exists: true } }).select('userId items');
    const cartMap = new Map();
    activeCarts.forEach(c => {
      const total = c.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      cartMap.set(String(c.userId), { count: c.items.length, total });
    });

    res.json(users.map(u => {
      const cart = cartMap.get(String(u._id));
      return {
        _id: u._id,
        username: u.username,
        lat: u.location && u.location.lat != null ? u.location.lat : null,
        lon: u.location && u.location.lon != null ? u.location.lon : null,
        acc: u.locationAcc != null ? u.locationAcc : null,
        src: u.locationSource || 'IP',
        landmark: u.landmark || '',
        address: u.address || '',
        updatedAt: u.updatedAt,
        cartCount: cart ? cart.count : 0,
        cartTotal: cart ? cart.total : 0
      };
    }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fetch user locations failed' })
  }
});
app.get('/api/admin/user/location', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me || me.role !== 'admin' || me.username !== 'AJadmin') return res.status(403).json({ error: 'Admin only' });
    const email = String((req.query && req.query.email) || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const loc = user.location || {};
    res.json({
      username: user.username,
      email: user.email || '',
      userLocation: { lat: loc.lat ?? null, lon: loc.lon ?? null, acc: user.locationAcc ?? null },
      userLandmark: user.landmark || ''
    });
  } catch (e) {
    res.status(500).json({ error: 'Lookup failed' })
  }
});

// Serve React production build
const buildDir = path.join(__dirname, '..', 'build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get(/^\/(?!api|images|site-assets|tendercuts).*/, (req, res) => {
    res.sendFile(path.join(buildDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
