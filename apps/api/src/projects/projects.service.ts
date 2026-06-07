import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma, Project } from '@testlens/db';
import { GitUrlValidator } from '../common/utils/git-url.validator';

@Injectable()
export class ProjectsService {
  /**
   * Registers a new project in the database after validating GitHub URL.
   */
  public async createProject(
    data: { name: string; repoUrl: string; branch: string; token?: string },
    userId?: string
  ): Promise<Project> {
    const isValidUrl = GitUrlValidator.validate(data.repoUrl);
    if (!isValidUrl) {
      throw new BadRequestException('Invalid GitHub repository URL. Secure HTTPS url is required.');
    }

    return prisma.project.create({
      data: {
        name: data.name,
        repoUrl: data.repoUrl,
        branch: data.branch || 'main',
        authTokenEncrypted: data.token || null,
        userId: userId || null
      }
    });
  }

  /**
   * Lists all registered projects in database.
   */
  public async getAllProjects(userId?: string): Promise<Project[]> {
    return prisma.project.findMany({
      where: {
        OR: [
          { userId: userId || undefined },
          { userId: null }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Fetches detailed project metadata.
   */
  public async getProjectById(id: string, userId?: string): Promise<Project | null> {
    const project = await prisma.project.findUnique({
      where: { id }
    });
    
    if (!project) return null;

    // Enforce ownership checks if project belongs to a user
    if (project.userId && project.userId !== userId) {
      return null;
    }

    return project;
  }
}
