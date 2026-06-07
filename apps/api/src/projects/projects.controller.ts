import { Controller, Post, Get, Body, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  public async create(
    @Body() body: { name: string; repoUrl: string; branch: string; token?: string },
    @CurrentUser() user: any
  ) {
    return this.projectsService.createProject(body, user.id);
  }

  @Get()
  public async findAll(@CurrentUser() user: any) {
    return this.projectsService.getAllProjects(user.id);
  }

  @Get(':id')
  public async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const project = await this.projectsService.getProjectById(id, user.id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found or access denied`);
    }
    return project;
  }
}
