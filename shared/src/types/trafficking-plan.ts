/**
 * TraffickingPlan — structured data extracted from an Insertion Order (IO) document.
 *
 * Represents the complete trafficking plan including campaign details, placements,
 * billing terms, quality requirements, and naming taxonomy. Extracted by Claude
 * from PDF/Excel IO uploads and validated with Zod before presentation to the user.
 */
export interface TraffickingPlan {
  // Document metadata
  ioNumber?: string;
  version?: string;
  publisherRep?: string;
  agencyContact?: string;
  approvalDate?: string;

  // Campaign (required)
  campaign: {
    name: string;
    advertiserName: string;
    startDate: string;           // ISO format
    endDate: string;
    budget?: number;
    notes?: string;
    kpis?: Array<{
      metric: string;            // "CTR", "CPA", "ROAS", "Brand Lift"
      target: string;            // "0.15%", "$25", "3.5x"
    }>;
    reportingRequirements?: {
      frequency?: string;        // "Weekly", "Monthly"
      metrics?: string[];
      format?: string;           // "Excel", "PDF", "Dashboard"
      recipients?: string[];
    };
  };

  // Billing & terms
  billing?: {
    paymentTerms?: string;       // "Net 30", "Net 60"
    poNumber?: string;
    agencyCommission?: number;
    billingContact?: string;
    adServingFee?: {
      rate?: number;
      paidBy?: 'Advertiser' | 'Publisher';
      included?: boolean;
    };
  };

  // Contract terms
  terms?: {
    cancellation?: {
      noticePeriod?: string;
      fee?: string;
      minimumCommitment?: string;
    };
    makeGood?: {
      policy?: string;
      threshold?: number;
    };
  };

  // Brand safety & viewability
  qualityRequirements?: {
    viewability?: {
      minimumPercentage?: number;
      standard?: string;          // "MRC", "GroupM"
      vendor?: string;            // "MOAT", "IAS", "DoubleVerify"
    };
    brandSafety?: {
      blockedCategories?: string[];
      blockedKeywords?: string[];
      verificationVendor?: string;
      customSettings?: string;
    };
  };

  // Placement groups
  placementGroups?: Array<{
    name: string;
    type: 'Package' | 'Roadblock';
    placementIndices: number[];
    sharedBudget?: number;
  }>;

  // Placements (required)
  placements: Array<{
    // Core
    siteName: string;
    name: string;
    size: string;
    startDate: string;
    endDate: string;

    // Pricing
    rate?: number;
    rateType?: 'CPM' | 'CPC' | 'CPA' | 'Flat';
    impressions?: number;
    cost?: number;

    // Creative specs
    creativeType?: 'Display' | 'Video' | 'Rich Media' | 'Native';
    creativeRotation?: 'Even' | 'Weighted' | 'Sequential' | 'Optimized';
    companionSizes?: string[];
    backupImage?: boolean;
    vastVpaid?: 'VAST' | 'VPAID' | 'VAST+VPAID';
    videoLength?: number;

    // Delivery
    frequencyCap?: {
      impressions: number;
      period: 'Day' | 'Week' | 'Month' | 'Lifetime';
      perUser?: boolean;
    };

    // Targeting
    targeting?: {
      geo?: string[];
      devices?: string[];
      audiences?: string[];
      dayparting?: string;
    };

    // Tracking
    tracking?: {
      thirdPartyPixels?: string[];
      verificationVendor?: string;
      floodlightActivity?: string;
      clickTracker?: string;
    };

    // Environment
    environment?: {
      type?: string[];           // "Web", "In-App", "AMP", "CTV"
      browsers?: string[];
      os?: string[];
      crossDevice?: boolean;
    };

    // Group & destination
    groupName?: string;
    landingPageUrl?: string;
    notes?: string;
  }>;

  // Naming taxonomy (recommended by Kiki, confirmed by user)
  taxonomy?: {
    campaignNameFormat?: string;     // e.g., "{Advertiser}_{Quarter}-{Year}_{Channel}"
    placementNameFormat?: string;    // e.g., "{Site}_{Size}_{Month}{Year}_{Type}"
    adNameFormat?: string;
    creativeNameFormat?: string;
    utmSettings?: {
      source?: string;              // Template: "{site}"
      medium?: string;              // Template: "display"
      campaign?: string;            // Template: "{advertiser}_{quarter}_{year}"
      content?: string;             // Template: "{size}_{placement_type}"
      term?: string;
    };
    confirmed?: boolean;            // Set to true after user confirms
  };

  // Extraction quality (required)
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
  rawFieldsUnmapped?: string[];
}
