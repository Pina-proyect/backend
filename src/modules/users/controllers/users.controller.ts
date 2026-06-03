import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../services/users.service';
import { UpdateProfileDto } from '../../auth/dto/update-profile.dto';
import type { Creator } from '@prisma/client';

@Controller('users')

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: any) {
    const userId = req.user.id;
    const creator = await this.usersService.getProfile(userId);
    
    return {
      id: creator.id,
      fullName: creator.fullName,
      email: creator.email,
      slug: creator.slug,
      bio: creator.bio,
      phone: creator.phone,
      photoPath: creator.photoPath,
      verificationStatus: creator.verificationStatus,
      provider: creator.provider,
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
      mpAccessToken: creator.mpAccessToken,
      mpPublicKey: creator.mpPublicKey,
      pinaPrice: creator.pinaPrice,
      donationGoalTitle: creator.donationGoalTitle,
      donationGoalAmount: creator.donationGoalAmount,
      gender: creator.gender,
    };
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchCreators(
    @Query('q') q?: string,
    @Query('niche') niche?: string
  ) {
    return this.usersService.searchCreators(q, niche);
  }

  @Get('profile/:slug')
  @HttpCode(HttpStatus.OK)
  async getProfileBySlug(@Param('slug') slug: string) {
    const creator = await this.usersService.getProfileBySlug(slug);
    
    if (!creator) {
      return null;
    }
    
    return {
      id: creator.id,
      fullName: creator.fullName,
      email: creator.email,
      slug: creator.slug,
      bio: creator.bio,
      photoPath: creator.photoPath,
      niche: creator.niche,
      instagram: creator.instagram,
      tiktok: creator.tiktok,
      youtube: creator.youtube,
      provider: creator.provider,
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
      pinaPrice: creator.pinaPrice,
      donationGoalTitle: creator.donationGoalTitle,
      donationGoalAmount: creator.donationGoalAmount,
      gender: creator.gender,
    };
  }
  
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = req.user.id;
    const updatedCreator = await this.usersService.updateProfile(userId, updateProfileDto);
    
    return {
      id: updatedCreator.id,
      fullName: updatedCreator.fullName,
      email: updatedCreator.email,
      slug: updatedCreator.slug,
      bio: updatedCreator.bio,
      phone: updatedCreator.phone,
      photoPath: updatedCreator.photoPath,
      verificationStatus: updatedCreator.verificationStatus,
      provider: updatedCreator.provider,
      createdAt: updatedCreator.createdAt,
      updatedAt: updatedCreator.updatedAt,
      mpAccessToken: updatedCreator.mpAccessToken,
      mpPublicKey: updatedCreator.mpPublicKey,
      pinaPrice: updatedCreator.pinaPrice,
      donationGoalTitle: updatedCreator.donationGoalTitle,
      donationGoalAmount: updatedCreator.donationGoalAmount,
      gender: updatedCreator.gender,
    };
  }
}
