import { Controller, Post, Get, Body, Param, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  public async create(
    @Body() body: { name: string; repoUrl: string; branch: string; token?: string }
  ) {
    return this.projectsService.createProject(body);
  }

  @Get()
  public async findAll() {
    return this.projectsService.getAllProjects();
  }

  @Get(':id')
  public async findOne(@Param('id') id: string) {
    const project = await this.projectsService.getProjectById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }
}
