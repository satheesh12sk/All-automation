export interface DiscoveryQuestion {
  id: string;
  prompt: string;
  acceptedAnswers: string[];
}

export interface DiscoveryData {
  language: string;
  questions: DiscoveryQuestion[];
}

export interface Account {
  username: string;
  grade?: string;
  notes?: string;
}
