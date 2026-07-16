import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import type { CandidateView } from './candidate.view';
import {
  AssignScoreDto,
  ChangeStageDto,
  CreateCandidateDto,
  ExtendOfferDto,
} from './dto';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post()
  create(@Body() dto: CreateCandidateDto): Promise<{ candidateId: string }> {
    return this.candidatesService.submitApplication(dto);
  }

  @Post(':id/stage')
  @HttpCode(HttpStatus.OK)
  changeStage(
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
  ): Promise<{ ok: true }> {
    return this.candidatesService.changeStage(id, dto);
  }

  @Post(':id/score')
  @HttpCode(HttpStatus.OK)
  assignScore(
    @Param('id') id: string,
    @Body() dto: AssignScoreDto,
  ): Promise<{ ok: true }> {
    return this.candidatesService.assignScore(id, dto);
  }

  @Post(':id/offer')
  @HttpCode(HttpStatus.OK)
  extendOffer(
    @Param('id') id: string,
    @Body() dto: ExtendOfferDto,
  ): Promise<{ ok: true }> {
    return this.candidatesService.extendOffer(id, dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<CandidateView> {
    return this.candidatesService.getCandidate(id);
  }
}
