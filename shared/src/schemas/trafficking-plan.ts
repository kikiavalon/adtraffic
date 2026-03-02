import { z } from 'zod';

// ── Sub-schemas ──

const KpiSchema = z.object({
  metric: z.string(),
  target: z.string(),
}).strip();

const ReportingRequirementsSchema = z.object({
  frequency: z.string().optional(),
  metrics: z.array(z.string()).optional(),
  format: z.string().optional(),
  recipients: z.array(z.string()).optional(),
}).strip();

const CampaignSchema = z.object({
  name: z.string(),
  advertiserName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.number().optional(),
  notes: z.string().optional(),
  kpis: z.array(KpiSchema).optional(),
  reportingRequirements: ReportingRequirementsSchema.optional(),
}).strip();

const AdServingFeeSchema = z.object({
  rate: z.number().optional(),
  paidBy: z.enum(['Advertiser', 'Publisher']).optional(),
  included: z.boolean().optional(),
}).strip();

const BillingSchema = z.object({
  paymentTerms: z.string().optional(),
  poNumber: z.string().optional(),
  agencyCommission: z.number().optional(),
  billingContact: z.string().optional(),
  adServingFee: AdServingFeeSchema.optional(),
}).strip();

const CancellationSchema = z.object({
  noticePeriod: z.string().optional(),
  fee: z.string().optional(),
  minimumCommitment: z.string().optional(),
}).strip();

const MakeGoodSchema = z.object({
  policy: z.string().optional(),
  threshold: z.number().optional(),
}).strip();

const TermsSchema = z.object({
  cancellation: CancellationSchema.optional(),
  makeGood: MakeGoodSchema.optional(),
}).strip();

const ViewabilitySchema = z.object({
  minimumPercentage: z.number().optional(),
  standard: z.string().optional(),
  vendor: z.string().optional(),
}).strip();

const BrandSafetySchema = z.object({
  blockedCategories: z.array(z.string()).optional(),
  blockedKeywords: z.array(z.string()).optional(),
  verificationVendor: z.string().optional(),
  customSettings: z.string().optional(),
}).strip();

const QualityRequirementsSchema = z.object({
  viewability: ViewabilitySchema.optional(),
  brandSafety: BrandSafetySchema.optional(),
}).strip();

const PlacementGroupSchema = z.object({
  name: z.string(),
  type: z.enum(['Package', 'Roadblock']),
  placementIndices: z.array(z.number()),
  sharedBudget: z.number().optional(),
}).strip();

const FrequencyCapSchema = z.object({
  impressions: z.number(),
  period: z.enum(['Day', 'Week', 'Month', 'Lifetime']),
  perUser: z.boolean().optional(),
}).strip();

const TargetingSchema = z.object({
  geo: z.array(z.string()).optional(),
  devices: z.array(z.string()).optional(),
  audiences: z.array(z.string()).optional(),
  dayparting: z.string().optional(),
}).strip();

const TrackingSchema = z.object({
  thirdPartyPixels: z.array(z.string()).optional(),
  verificationVendor: z.string().optional(),
  floodlightActivity: z.string().optional(),
  clickTracker: z.string().optional(),
}).strip();

const EnvironmentSchema = z.object({
  type: z.array(z.string()).optional(),
  browsers: z.array(z.string()).optional(),
  os: z.array(z.string()).optional(),
  crossDevice: z.boolean().optional(),
}).strip();

const PlacementSchema = z.object({
  // Core (required)
  siteName: z.string(),
  name: z.string(),
  size: z.string(),
  startDate: z.string(),
  endDate: z.string(),

  // Pricing
  rate: z.number().optional(),
  rateType: z.enum(['CPM', 'CPC', 'CPA', 'Flat']).optional(),
  impressions: z.number().optional(),
  cost: z.number().optional(),

  // Creative specs
  creativeType: z.enum(['Display', 'Video', 'Rich Media', 'Native']).optional(),
  creativeRotation: z.enum(['Even', 'Weighted', 'Sequential', 'Optimized']).optional(),
  companionSizes: z.array(z.string()).optional(),
  backupImage: z.boolean().optional(),
  vastVpaid: z.enum(['VAST', 'VPAID', 'VAST+VPAID']).optional(),
  videoLength: z.number().optional(),

  // Delivery
  frequencyCap: FrequencyCapSchema.optional(),

  // Targeting
  targeting: TargetingSchema.optional(),

  // Tracking
  tracking: TrackingSchema.optional(),

  // Environment
  environment: EnvironmentSchema.optional(),

  // Group & destination
  groupName: z.string().optional(),
  landingPageUrl: z.string().optional(),
  notes: z.string().optional(),
}).strip();

const UtmSettingsSchema = z.object({
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  content: z.string().optional(),
  term: z.string().optional(),
}).strip();

const TaxonomySchema = z.object({
  campaignNameFormat: z.string().optional(),
  placementNameFormat: z.string().optional(),
  adNameFormat: z.string().optional(),
  creativeNameFormat: z.string().optional(),
  utmSettings: UtmSettingsSchema.optional(),
  confirmed: z.boolean().optional(),
}).strip();

// ── Main schema ──

export const TraffickingPlanSchema = z.object({
  // Document metadata
  ioNumber: z.string().optional(),
  version: z.string().optional(),
  publisherRep: z.string().optional(),
  agencyContact: z.string().optional(),
  approvalDate: z.string().optional(),

  // Campaign (required)
  campaign: CampaignSchema,

  // Billing & terms
  billing: BillingSchema.optional(),

  // Contract terms
  terms: TermsSchema.optional(),

  // Brand safety & viewability
  qualityRequirements: QualityRequirementsSchema.optional(),

  // Placement groups
  placementGroups: z.array(PlacementGroupSchema).optional(),

  // Placements (required)
  placements: z.array(PlacementSchema),

  // Naming taxonomy
  taxonomy: TaxonomySchema.optional(),

  // Extraction quality (required)
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()).optional(),
  rawFieldsUnmapped: z.array(z.string()).optional(),
}).strip();

export type ValidatedTraffickingPlan = z.infer<typeof TraffickingPlanSchema>;
