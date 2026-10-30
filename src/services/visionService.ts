export type VisionProvider = 'claude' | 'openai';

export function resolveVisionProvider(): VisionProvider {
  const raw = (process.env.VISION_PROVIDER || 'claude').toLowerCase();
  if (raw !== 'claude' && raw !== 'openai') {
    throw new Error(`Unknown VISION_PROVIDER "${raw}" (expected claude | openai)`);
  }
  return raw;
}

/**
 * Answers a picture-based multiple-choice question with a vision model.
 * Provider from VISION_PROVIDER, model from VISION_MODEL, key from ANTHROPIC_API_KEY / OPENAI_API_KEY.
 */
export class VisionService {
  readonly provider: VisionProvider;
  readonly model: string;

  constructor(provider: VisionProvider = resolveVisionProvider(), model = process.env.VISION_MODEL || '') {
    this.provider = provider;
    this.model = model;
  }

  get describe(): string {
    return `${this.provider}${this.model ? `/${this.model}` : ''}`;
  }

  private apiKey(): string | undefined {
    return this.provider === 'claude' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(this.apiKey() && this.model);
  }

  /** Returns the text of the option the model picks. */
  async answer(imageBase64: string, mediaType: string, question: string, options: string[]): Promise<string> {
    // TODO: implement provider calls (Mastery scope)
    void imageBase64;
    void mediaType;
    void question;
    void options;
    throw new Error(`VisionService(${this.describe}).answer is not implemented yet`);
  }
}

/** Sends a screenshot + question to the configured vision model and returns its answer. */
export async function gradeImage(image: Buffer, question: string): Promise<string> {
  return new VisionService().answer(image.toString('base64'), 'image/png', question, []);
}
