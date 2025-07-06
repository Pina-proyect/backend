export interface KycResponse {
  status: 'pending' | 'verified' | 'rejected';
  message: string;
  userId: string;
}
