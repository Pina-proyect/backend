import { Prisma } from '@prisma/client';
import { UpdateProfileDto } from '../dto/update-profile.dto';

/**
 * Convierte un UpdateProfileDto en Prisma.CreatorUpdateInput,
 * incluyendo los campos de IA (v1.18) con la conversión Json necesaria.
 */
export function mapUpdateProfileDto(
  dto: UpdateProfileDto,
): Prisma.CreatorUpdateInput {
  const data: Prisma.CreatorUpdateInput = {};
  if (dto.slug !== undefined) data.slug = dto.slug;
  if (dto.bio !== undefined) data.bio = dto.bio;
  if (dto.country !== undefined) data.country = dto.country;
  if (dto.fullName !== undefined) data.fullName = dto.fullName;
  if (dto.phone !== undefined) data.phone = dto.phone;
  if (dto.niche !== undefined) data.niche = dto.niche;
  if (dto.gender !== undefined) data.gender = dto.gender;
  if (dto.instagram !== undefined) data.instagram = dto.instagram;
  if (dto.tiktok !== undefined) data.tiktok = dto.tiktok;
  if (dto.youtube !== undefined) data.youtube = dto.youtube;
  if (dto.mpAccessToken !== undefined) data.mpAccessToken = dto.mpAccessToken;
  if (dto.pinaPrice !== undefined) data.pinaPrice = dto.pinaPrice;
  if (dto.donationGoalTitle !== undefined) {
    data.donationGoalTitle = dto.donationGoalTitle;
  }
  if (dto.donationGoalAmount !== undefined) {
    data.donationGoalAmount = dto.donationGoalAmount;
  }
  // IA Onboarding (v1.18)
  if (dto.socialLinks !== undefined) {
    data.socialLinks = dto.socialLinks as unknown as Prisma.InputJsonValue;
  }
  if (dto.aiSummary !== undefined) data.aiSummary = dto.aiSummary;
  if (dto.aiSuggestedNiche !== undefined) {
    data.aiSuggestedNiche = dto.aiSuggestedNiche;
  }
  if (dto.aiSuggestedBio !== undefined) {
    data.aiSuggestedBio = dto.aiSuggestedBio;
  }
  if (dto.aiSuggestedGoal !== undefined) {
    data.aiSuggestedGoal = dto.aiSuggestedGoal;
  }
  if (dto.aiSuggestedPlan !== undefined) {
    data.aiSuggestedPlan = dto.aiSuggestedPlan;
  }
  if (dto.aiPlanAccepted !== undefined) {
    data.aiPlanAccepted = dto.aiPlanAccepted;
    if (dto.aiPlanAccepted) {
      data.aiLastAnalyzedAt = new Date();
    }
  }
  return data;
}
