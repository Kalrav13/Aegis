import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma, Project } from '@testlens/db';
import { GitUrlValidator } from '../common/utils/git-url.validator';

@Injectable()
export class ProjectsService {
  /**
   * Registers a new project in the database after validating GitHub URL.
   */
  public async createProject(data: { name: string; repoUrl: string; branch: string; token?: string }): Promise<Project> {
    const isValidUrl = GitUrlValidator.validate(data.repoUrl);
    if (!isValidUrl) {
      throw new BadRequestException('Invalid GitHub repository URL. Secure HTTPS url is required.');
    }

    return prisma.project.create({
      data: {
        name: data.name,
        repoUrl: data.repoUrl,
        branch: data.branch || 'main',
        authTokenEncrypted: data.token || null
      }
    });
  }

  /**
   * Lists all registered projects in database.
   */
  public async getAllProjects(): Promise<Project[]> {
    return prisma.project.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Fetches detailed project metadata.
   */
  public async getProjectById(id: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id }
    });
  }
}
