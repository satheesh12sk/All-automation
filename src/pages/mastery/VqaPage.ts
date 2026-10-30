import type { Page } from '@playwright/test';
import type { LangCode } from '../../utils/languages';
import { gradeImage } from '../../services/visionService';

/** Visual question-answer speaking assessment. */
export class VqaPage {
  constructor(private readonly page: Page, private readonly lang: LangCode) {}

  async answerFromScreenshot(question: string): Promise<string> {
    const image = await this.page.screenshot();
    return gradeImage(image, question);
  }
}
