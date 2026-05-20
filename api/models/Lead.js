const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // 1. New Lead Fields
  companyName: { type: String, required: true },
  businessType: {
    type: String,
    required: true,
    enum: [
      'Retail Shop', 'Cash & Carry', 'Wholesaler', 'Distributor',
      'Restaurant / Café', 'Supermarket', 'Online Store', 'Event Buyer',
      'Hotel', 'Catering Company', 'Gym / Sports Club', 'Other'
    ]
  },
  contactPerson: { type: String },
  phoneWhatsApp: { type: String, required: true },
  email: { type: String },
  cityArea: { type: String, required: true },
  postcode: { type: String },
  interestedProducts: [{ type: String }],
  leadOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplier: { type: String },
  notes: { type: String },
  leadSource: { type: String },
  status: {
    type: String,
    enum: [
      'New Lead', 'Contacted', 'Qualified Lead', 'Sample / Price Sent',
      'Order Confirmed', 'Delivery Scheduled', 'Delivered', 'Payment Pending',
      'Payment Received', 'Active Customer / Repeat Order', 'Lost Lead'
    ],
    default: 'New Lead'
  },

  // 2. CONTACTED Stage Fields
  dateContacted: { type: Date },
  contactMethod: { type: String, enum: ['Call', 'WhatsApp', 'Visit', 'Email'] },
  response: { type: String, enum: ['Interested', 'No Response', 'Not Interested'] },
  contactNotes: { type: String },
  nextFollowUpDate: { type: Date },

  // 2.A Interested / 3. QUALIFIED LEAD Fields
  sellsCompetitorBrands: { type: String, enum: ['Yes', 'No'] },
  topCompetitorBrandName: { type: String },
  usualOrderQuantity: { type: String },
  decisionMaker: { type: String, enum: ['POC', 'Owner', 'Manager', 'Buyer', 'Other'] },
  isCurrentContactDecisionMaker: { type: String, enum: ['Yes', 'No'] },
  decisionMakerName: { type: String },
  decisionMakerContactNumber: { type: String },
  needsSamplePricing: { type: String, enum: ['Sample', 'Price List', 'Both'] },
  requiredNextStep: {
    type: String,
    enum: ['Send distributor details', 'Send Samples', 'Send Catalogue', 'Schedule Visit', 'Send Company Profile', 'Create Order']
  },

  // 2.C Not Interested / Lost Lead Fields
  lostReason: {
    type: String,
    enum: [
      'Already has supplier', 'Delivery area issue', 'Low demand',
      'Competitor gave better deal', 'Price issue', 'Wrong contact details',
      'Not selling soft drinks', 'Not interested at the moment', 'Other'
    ]
  },

  // 4. Sample / Price Sent Fields
  productsOffered: [{ type: String }],
  priceListSent: { type: String, enum: ['Yes', 'No'] },
  sampleDelivered: { type: String, enum: ['Yes', 'No'] },
  catalogueSent: { type: String, enum: ['Yes', 'No'] },
  companyProfileSent: { type: String, enum: ['Yes', 'No'] },
  sampleDeliveryDate: { type: Date },
  customerFeedback: { type: String },
  customerAgreed: { type: String, enum: ['Yes', 'No', 'Pending'] },
  reasonForDecision: { type: String },

  // Next Step conditional fields
  visitScheduledDate: { type: Date },
  otoRef: { type: String },
  otoOrderId: { type: String },
  trackingId: { type: String },
  sampleRecipientName: { type: String },
  sampleAddress: { type: String },
  samplePostcode: { type: String },
  sampleContactNo: { type: String },

  // 5. Order & Delivery Fields
  deliveryDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true }
});

leadSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// ─── Indexes for pagination & filtering performance ─────────────────────
leadSchema.index({ workspace: 1, createdAt: -1 });
leadSchema.index({ workspace: 1, status: 1, createdAt: -1 });
leadSchema.index({ workspace: 1, leadOwner: 1, createdAt: -1 });
leadSchema.index({ workspace: 1, nextFollowUpDate: 1 });

module.exports = mongoose.model('Lead', leadSchema);

