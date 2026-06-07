import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { UiScannerService } from './ui-scanner.service';
import { ApiScannerService } from './api-scanner.service';
import { InteractionRegistry, UIElement, APIEndpoint } from './registry.types';
import { FilterManifest } from '../filter/filter.service';

@Injectable()
export class RegistryService {
  constructor(
    private readonly uiScanner: UiScannerService,
    private readonly apiScanner: ApiScannerService
  ) {}

  /**
   * Scans filtered files in a repository and compiles the interaction registry.
   */
  public async generateRegistry(
    repoPath: string,
    filteredManifest: FilterManifest
  ): Promise<InteractionRegistry> {
    const uiElements: UIElement[] = [];
    const apiEndpoints: APIEndpoint[] = [];

    for (const file of filteredManifest.filtered_files) {
      const absolutePath = path.join(repoPath, file.path);

      // Perform parallel scan of file contents to reduce I/O waiting times
      const [fileUiElements, fileApiEndpoints] = await Promise.all([
        this.uiScanner.scanFile(absolutePath, file.path),
        this.apiScanner.scanFile(absolutePath, file.path)
      ]);

      uiElements.push(...fileUiElements);
      apiEndpoints.push(...fileApiEndpoints);
    }

    return {
      ui_elements: uiElements,
      api_endpoints: apiEndpoints
    };
  }
}
