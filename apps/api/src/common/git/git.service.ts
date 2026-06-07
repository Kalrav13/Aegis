import { Injectable } from '@nestjs/common';
import simpleGit, { SimpleGit } from 'simple-git';

@Injectable()
export class GitService {
  /**
   * Safe asynchronous git clone using simple-git arguments mapping to prevent injection.
   * Enforces a 120-second download timeout.
   */
  public async clone(repoUrl: string, targetPath: string, token?: string): Promise<string> {
    // Inject auth token if provided for private repository access
    let cloneUrl = repoUrl;
    if (token) {
      const httpsPrefix = 'https://';
      if (repoUrl.startsWith(httpsPrefix)) {
        cloneUrl = `${httpsPrefix}${token}@${repoUrl.slice(httpsPrefix.length)}`;
      }
    }

    const git: SimpleGit = simpleGit();

    // Enforce timeout and git options safely passed as arguments arrays
    await Promise.race([
      git.clone(cloneUrl, targetPath, [
        '--depth=1', // Shallow clone to save space and time
        '--no-checkout' // Optimize speed by checking out branch commit dynamically
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Git clone timed out after 120 seconds')), 120000)
      )
    ]);

    // Perform minimal checkout to retrieve HEAD commit SHA
    const repoGit: SimpleGit = simpleGit(targetPath);
    await repoGit.checkout('HEAD');
    const revParse = await repoGit.revparse(['HEAD']);
    
    return revParse.trim();
  }
}
