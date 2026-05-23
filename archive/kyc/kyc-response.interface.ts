export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface KycResponse {
  status: VerificationStatus;
  message: string;
  userId: string;
}
