export class GitUrlValidator {
  private static readonly GITHUB_HTTPS_REGEX =
    /^https:\/\/(?:[a-zA-Z0-9-]+\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?$/;

  /**
   * Validates if the given URL is a secure HTTPS GitHub repository URL.
   * SSH URLs are rejected for V1 simplicity.
   */
  public static validate(url: string): boolean {
    if (!url) return false;
    
    // Check match
    const match = this.GITHUB_HTTPS_REGEX.exec(url.trim());
    if (!match) return false;

    const [, username, repo] = match;
    
    // Ensure owner and repo names do not contain invalid directory traversal patterns
    if (username === '.' || username === '..' || repo === '.' || repo === '..') {
      return false;
    }

    return true;
  }
}
