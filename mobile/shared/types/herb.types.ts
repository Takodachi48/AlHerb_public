export interface Herb {
  _id: string;
  name: string;
  scientificName: string;
  commonNames: string[];
  description: string;
  family?: string;
  partsUsed: string[];
  properties: string[];
  symptoms: string[];
  contraindications: string[];
  interactions: Array<{
    medication: string;
    effect: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
  dosage: {
    adult: DosageInfo;
    child?: DosageInfo;
    elderly?: DosageInfo;
  };
  preparation: Array<{
    method: 'tea' | 'tincture' | 'capsule' | 'powder' | 'ointment' | 'essential_oil' | 'compress';
    instructions: string;
    ratio?: string;
  }>;
  images: Array<{
    url: string;
    caption?: string;
    isPrimary?: boolean;
  }>;
  safety: {
    pregnancy: 'safe' | 'caution' | 'avoid';
    breastfeeding: 'safe' | 'caution' | 'avoid';
    children: 'safe' | 'caution' | 'avoid';
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DosageInfo {
  min?: string;
  max?: string;
  unit?: string;
  frequency?: string;
}
