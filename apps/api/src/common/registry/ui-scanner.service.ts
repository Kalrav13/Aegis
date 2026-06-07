import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import { UIElement } from './registry.types';
import {
  DATA_TESTID_REGEX,
  ID_REGEX,
  NAME_REGEX,
  TYPE_REGEX,
  UI_TAG_REGEX
} from './registry.config';

@Injectable()
export class UiScannerService {
  private readonly MAX_SCAN_SIZE_BYTES = 1048576; // 1MB scan ceiling

  /**
   * Scans a file and extracts flat UI elements.
   */
  public async scanFile(absolutePath: string, relativePath: string): Promise<UIElement[]> {
    try {
      const stats = await fs.stat(absolutePath);
      if (stats.size > this.MAX_SCAN_SIZE_BYTES) {
        console.warn(`Skipping scan of large file: ${relativePath} (${stats.size} bytes)`);
        return [];
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      const elements: UIElement[] = [];

      // Reset regex index states
      UI_TAG_REGEX.lastIndex = 0;

      let match;
      while ((match = UI_TAG_REGEX.exec(content)) !== null) {
        const type = match[1].toLowerCase() as UIElement['type'];
        const attributesBlock = match[2];

        // Parse key-value attributes from the tag's inner block
        const dataTestId = this.extractAttribute(attributesBlock, DATA_TESTID_REGEX);
        const id = this.extractAttribute(attributesBlock, ID_REGEX);
        const name = this.extractAttribute(attributesBlock, NAME_REGEX);
        const inputType = type === 'input' ? this.extractAttribute(attributesBlock, TYPE_REGEX) : undefined;

        // Only register if it has selector attributes or is a structural element (form, select, textarea, button)
        if (dataTestId || id || name || type === 'form' || type === 'select' || type === 'textarea' || type === 'button') {
          elements.push({
            path: relativePath.replace(/\\/g, '/'),
            type,
            attributes: {
              ...(dataTestId && { dataTestId }),
              ...(id && { id }),
              ...(name && { name }),
              ...(inputType && { type: inputType })
            }
          });
        }
      }

      return elements;
    } catch (error: any) {
      console.error(`Failed to scan UI elements in ${relativePath}:`, error.message);
      return [];
    }
  }

  private extractAttribute(attributesBlock: string, regex: RegExp): string | undefined {
    regex.lastIndex = 0;
    const match = regex.exec(attributesBlock);
    return match ? match[1] : undefined;
  }
}
