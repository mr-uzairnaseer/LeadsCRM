const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./utils/db');
const Lead = require('./models/Lead');
const User = require('./models/User');
const Activity = require('./models/Activity');
const Order = require('./models/Order');
const Delivery = require('./models/Delivery');
const Workspace = require('./models/Workspace');
const jwt = require('jsonwebtoken');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const app = express();

app.use(cors());
app.use(express.json());

// ─── DB Connection Middleware ───────────────────────────────────────────
// Single place to ensure DB connection for all /api routes,
// so individual handlers don't need to call connectDB() themselves.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (e) {
    res.status(503).send({ error: 'Database unavailable' });
  }
});

// Critical Var Check
app.get('/api/debug', (req, res) => {
  res.send({
    hasMongoUri: !!process.env.MONGODB_URI,
    hasJwtSecret: !!process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    msg: "If hasMongoUri is false, you forgot to add it to Vercel Settings!"
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    res.send({ status: 'Connected to MongoDB successfully!' });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// Auth Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).send({ error: 'Authentication required.' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.id, workspace: decoded.workspaceId }).lean();
    
    if (!user) throw new Error();
    
    req.user = user;
    req.workspaceId = decoded.workspaceId;
    next();
  } catch (e) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// Auto-Seed Logic
const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@leadscrm.com';
    let admin = await User.findOne({ email: adminEmail });
    
    if (!admin) {
      admin = new User({
        name: 'System Admin',
        email: adminEmail,
        password: 'admin_password_123',
        role: 'Admin',
        isOwner: true
      });
      await admin.save();
      console.log('✅ Auto-Seed: Admin user created.');
    }

    if (!admin.workspace) {
      const workspace = new Workspace({
        name: 'Admin Workspace',
        owner: admin._id
      });
      await workspace.save();
      admin.workspace = workspace._id;
      await admin.save();
      console.log('✅ Auto-Seed: Admin workspace created and linked.');
    }
  } catch (e) {
    console.error('Seed error:', e);
  }
};

// ─── Helper: Populate a lead with owner info ────────────────────────────
const populateLead = (query) => query.populate('leadOwner', 'name role');

// Routes
app.get('/api/health', async (req, res) => {
  await seedAdmin();
  res.send({ status: 'API is healthy', message: 'Admin account checked/created' });
});

// Signup (Create Workspace + Owner)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, workspaceName } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).send({ error: 'Email already registered.' });

    // 1. Create User Instance
    const user = new User({
      name,
      email,
      password,
      role: 'BDM',
      isOwner: true
    });
    
    // 2. Create Workspace Instance
    const workspace = new Workspace({ 
      name: workspaceName,
      owner: user._id
    });
    
    // 3. Link User to Workspace
    user.workspace = workspace._id;
    
    await Promise.all([workspace.save(), user.save()]);
    
    const token = jwt.sign({ id: user._id, workspaceId: workspace._id, role: user.role }, process.env.JWT_SECRET);
    res.status(201).send({ user, workspace, token });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('workspace');
    
    if (!user) return res.status(400).send({ error: 'Invalid email or password' });
    
    console.log('Login attempt for:', email);
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', isMatch);
    
    if (!isMatch) return res.status(400).send({ error: 'Invalid email or password' });
    
    if (!user.workspace) return res.status(400).send({ error: 'User has no associated workspace.' });
    
    const token = jwt.sign({ id: user._id, workspaceId: user.workspace._id, role: user.role }, process.env.JWT_SECRET);
    res.send({ user, workspace: user.workspace, token });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// ─── LEAD ROUTES ────────────────────────────────────────────────────────

// Get All Leads — supports pagination + server-side filtering
app.get('/api/leads', auth, async (req, res) => {
  try {
    const {
      page, limit = 50,
      search, status, owner,
      sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = { workspace: req.workspaceId };
    if (status) filter.status = status;
    if (owner) filter.leadOwner = owner;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { companyName: regex },
        { contactPerson: regex },
        { phoneWhatsApp: regex },
        { postcode: regex },
        { cityArea: regex },
        { email: regex }
      ];
    }

    // Sort
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // If no page specified, return all (backward compatible)
    if (!page) {
      const leads = await Lead.find(filter)
        .populate('leadOwner', 'name role')
        .sort(sort)
        .lean();
      return res.send(leads);
    }

    // Paginated response
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Lead.find(filter)
        .populate('leadOwner', 'name role')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Lead.countDocuments(filter)
    ]);

    res.send({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + data.length < total
      }
    });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// Get Single Lead (for granular refresh)
app.get('/api/leads/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, workspace: req.workspaceId })
      .populate('leadOwner', 'name role')
      .lean();
    if (!lead) return res.status(404).send({ error: 'Lead not found' });
    res.send(lead);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// Create Lead — returns populated lead so frontend can insert directly
app.post('/api/leads', auth, async (req, res) => {
  try {
    const { companyName, phoneWhatsApp } = req.body;
    
    const existingLead = await Lead.findOne({
      workspace: req.workspaceId,
      $or: [{ companyName }, { phoneWhatsApp }]
    });
    
    if (existingLead) return res.status(400).send({ error: 'Lead with this Company Name or Phone Number already exists in your workspace.' });

    const leadOwner = req.body.leadOwner || req.user._id;
    const lead = new Lead({ ...req.body, leadOwner, workspace: req.workspaceId });
    await lead.save();
    
    // Create activity in background (don't block response)
    const activity = new Activity({
      user: req.user ? req.user.name : 'System',
      text: `Lead created: ${lead.companyName}`,
      lead: lead._id,
      workspace: req.workspaceId
    });
    activity.save().catch(e => console.error('Activity save error:', e));
    
    // Return populated lead for direct frontend insertion
    const populated = await Lead.findById(lead._id)
      .populate('leadOwner', 'name role')
      .lean();
    
    res.status(201).send(populated);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

// Update Lead — returns populated lead for optimistic update
app.patch('/api/leads/:id', auth, async (req, res) => {
  try {
    const originalLead = await Lead.findOne({ _id: req.params.id, workspace: req.workspaceId });
    if (!originalLead) return res.status(404).send({ error: 'Lead not found' });

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, workspace: req.workspaceId }, 
      req.body, 
      { new: true }
    ).populate('leadOwner', 'name role').lean();
    
    // Log activities in background (non-blocking)
    const activityPromises = [];
    
    if (req.body.status && req.body.status !== originalLead.status) {
      activityPromises.push(
        new Activity({
          user: req.user ? req.user.name : 'System',
          text: `Status updated to ${req.body.status}`,
          lead: lead._id,
          workspace: req.workspaceId
        }).save()
      );
    }

    if (req.body.leadOwner && String(req.body.leadOwner) !== String(originalLead.leadOwner)) {
      const newOwner = await User.findById(req.body.leadOwner).lean();
      activityPromises.push(
        new Activity({
          user: req.user ? req.user.name : 'System',
          text: `Assigned to ${newOwner ? newOwner.name : 'new owner'}`,
          lead: lead._id,
          workspace: req.workspaceId
        }).save()
      );
    }

    // Fire-and-forget activity logging
    if (activityPromises.length > 0) {
      Promise.all(activityPromises).catch(e => console.error('Activity save error:', e));
    }

    res.send(lead);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

// Delete Lead
app.delete('/api/leads/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, workspace: req.workspaceId });
    if (!lead) return res.status(404).send({ error: 'Lead not found' });
    
    // Delete associated activities in background
    Activity.deleteMany({ lead: lead._id, workspace: req.workspaceId })
      .catch(e => console.error('Activity cleanup error:', e));

    res.send(lead);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// --- USER ROUTES ---
app.get('/api/users', auth, async (req, res) => {
  try {
    const users = await User.find({ workspace: req.workspaceId }).select('-password').lean();
    res.send(users);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

app.post('/api/users', auth, async (req, res) => {
  try {
    // Permission check: only Owner or BDM can add users
    if (req.user.role !== 'BDM' && !req.user.isOwner) {
      return res.status(403).send({ error: 'Permission denied.' });
    }
    
    // Permission check: only Owner can create BDMs
    if (req.body.role === 'BDM' && !req.user.isOwner) {
      return res.status(403).send({ error: 'Only workspace owners can create Manager accounts.' });
    }

    const user = new User({ ...req.body, workspace: req.workspaceId });
    await user.save();
    
    // Return without password
    const response = user.toObject();
    delete response.password;
    res.status(201).send(response);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

app.patch('/api/users/:id', auth, async (req, res) => {
  try {
    const targetUser = await User.findOne({ _id: req.params.id, workspace: req.workspaceId });
    if (!targetUser) return res.status(404).send({ error: 'User not found' });

    // 1. Permission Check
    if (!req.user.isOwner) {
      // Must be BDM to edit anyone
      if (req.user.role !== 'BDM') return res.status(403).send({ error: 'Permission denied.' });
      
      // BDMs cannot edit other BDMs or Owner
      const isEditingSelf = targetUser._id.toString() === req.user._id.toString();
      if (!isEditingSelf && (targetUser.isOwner || targetUser.role === 'BDM')) {
        return res.status(403).send({ error: 'Managers cannot modify other administrators or the owner.' });
      }
    }

    // 2. Promotion Check
    if (req.body.role === 'BDM' && !req.user.isOwner) {
      return res.status(403).send({ error: 'Only workspace owners can promote users to Manager.' });
    }

    const { password, ...updates } = req.body;
    if (password) {
      console.log('Updating password for user:', targetUser.email);
      targetUser.password = password;
    }
    
    Object.assign(targetUser, updates);
    console.log('Modified paths:', targetUser.modifiedPaths());
    await targetUser.save();
    console.log('User saved successfully');
    
    const response = targetUser.toObject();
    delete response.password;
    res.send(response);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

app.delete('/api/users/:id', auth, async (req, res) => {
  try {
    const userToDelete = await User.findOne({ _id: req.params.id, workspace: req.workspaceId });
    if (!userToDelete) return res.status(404).send({ error: 'User not found' });
    
    // 1. Cannot delete owner
    if (userToDelete.isOwner) return res.status(403).send({ error: 'Cannot delete workspace owner.' });

    // 2. Permission check
    // If requester is not owner...
    if (!req.user.isOwner) {
      // Must be BDM to delete anyone
      if (req.user.role !== 'BDM') return res.status(403).send({ error: 'Permission denied. Only BDM or Owner can delete.' });
      
      // BDMs cannot delete other BDMs
      if (userToDelete.role === 'BDM') return res.status(403).send({ error: 'Managers cannot delete other administrators.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.send({ message: 'User deleted', _id: req.params.id });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// --- ACTIVITY ROUTES ---
app.get('/api/activity', auth, async (req, res) => {
  try {
    const { page, limit = 100 } = req.query;
    const filter = { workspace: req.workspaceId };

    // If no page specified, return latest (backward compatible)
    if (!page) {
      const activity = await Activity.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();
      return res.send(activity);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Activity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Activity.countDocuments(filter)
    ]);

    res.send({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + data.length < total
      }
    });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post('/api/activity', auth, async (req, res) => {
  try {
    const activity = new Activity({ 
      ...req.body, 
      user: req.user ? req.user.name : req.body.user,
      workspace: req.workspaceId 
    });
    await activity.save();
    res.status(201).send(activity);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

app.post('/api/activity/mark-all-read', auth, async (req, res) => {
  try {
    const result = await Activity.updateMany(
      { workspace: req.workspaceId, isRead: false }, 
      { isRead: true }
    );
    res.send({ message: 'All activities marked as read', modified: result.modifiedCount });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.delete('/api/activity/:id', auth, async (req, res) => {
  try {
    const activity = await Activity.findOneAndDelete({ _id: req.params.id, workspace: req.workspaceId });
    if (!activity) return res.status(404).send({ error: 'Activity not found' });
    res.send({ message: 'Activity deleted', _id: req.params.id });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Stats for Dashboard — single aggregation pipeline
app.get('/api/stats', auth, async (req, res) => {
  try {
    const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // Run all queries in parallel
    const [leadStats, todayFollowUps, samplesSent, monthlySalesResult, visitsCount] = await Promise.all([
      Lead.aggregate([
        { $match: { workspace: workspaceId } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Lead.countDocuments({ workspace: req.workspaceId, nextFollowUpDate: { $lte: endOfToday } }),
      Delivery.countDocuments({ workspace: req.workspaceId, deliveryType: 'Sales Sample' }),
      Order.aggregate([
        { $match: { 
            workspace: workspaceId,
            createdAt: { $gte: monthStart }
        }},
        { $group: { _id: null, total: { $sum: "$totalOrderValue" } } }
      ]),
      Lead.countDocuments({ workspace: req.workspaceId, contactMethod: 'Visit' })
    ]);

    const pipeline = {
      'New Lead': 0, 'Contacted': 0, 'Qualified Lead': 0, 
      'Sample / Price Sent': 0, 'Order Confirmed': 0, 
      'Delivery Scheduled': 0, 'Delivered': 0, 
      'Payment Pending': 0, 'Payment Received': 0, 
      'Active Customer / Repeat Order': 0, 'Completed': 0, 'Lost Lead': 0
    };

    let totalLeads = 0;
    leadStats.forEach(stat => {
      const status = stat._id || 'New Lead';
      if (pipeline[status] !== undefined) {
        pipeline[status] = stat.count;
      }
      totalLeads += stat.count;
    });

    res.send({
      totalLeads,
      newLeads: pipeline['New Lead'],
      contactedLeads: pipeline['Contacted'],
      visits: visitsCount,
      samplesSent,
      completedLeads: pipeline['Completed'] || 0,
      lostLeads: pipeline['Lost Lead'],
      pipeline
    });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// --- ORDER ROUTES ---
app.get('/api/orders', auth, async (req, res) => {
  try {
    const { page, limit = 50 } = req.query;
    const filter = { workspace: req.workspaceId };

    if (!page) {
      const orders = await Order.find(filter)
        .populate('lead')
        .populate('salesPerson')
        .sort({ createdAt: -1 })
        .lean();
      return res.send(orders);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Order.find(filter)
        .populate('lead')
        .populate('salesPerson')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter)
    ]);

    res.send({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + data.length < total
      }
    });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post('/api/orders', auth, async (req, res) => {
  try {
    const order = new Order({ ...req.body, workspace: req.workspaceId });
    
    // Save order and update lead status in parallel
    await Promise.all([
      order.save(),
      Lead.findOneAndUpdate(
        { _id: req.body.lead, workspace: req.workspaceId }, 
        { status: 'Order Confirmed' }
      )
    ]);
    
    res.status(201).send(order);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// --- DELIVERY ROUTES ---
app.get('/api/deliveries', auth, async (req, res) => {
  try {
    const { page, limit = 50 } = req.query;
    const filter = { workspace: req.workspaceId };

    if (!page) {
      const deliveries = await Delivery.find(filter)
        .populate('lead')
        .populate('order')
        .sort({ createdAt: -1 })
        .lean();
      return res.send(deliveries);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Delivery.find(filter)
        .populate('lead')
        .populate('order')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Delivery.countDocuments(filter)
    ]);

    res.send({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + data.length < total
      }
    });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post('/api/deliveries', auth, async (req, res) => {
  try {
    const delivery = new Delivery({ ...req.body, workspace: req.workspaceId });
    await delivery.save();
    res.status(201).send(delivery);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// Export for Vercel
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}
