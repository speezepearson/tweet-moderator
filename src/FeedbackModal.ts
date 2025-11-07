import { FeedbackEntry, TweetHash, TweetMetadata } from './types';
import { getFeedbackManager } from './FeedbackManager';
import { getCacheManager } from './CacheManager';

/**
 * Manages the feedback modal dialog for user corrections
 * Displays AI reasoning, tweet preview, and collects user feedback
 */
export class FeedbackModal {
  private modal: HTMLElement | null = null;
  private isOpen = false;

  /**
   * Opens the feedback modal for a tweet
   *
   * @param tweetText - The tweet text content
   * @param tweetHash - The hash of the tweet
   * @param aiSaidToxic - Whether AI classified as toxic
   * @param metadata - Tweet metadata (URL, author)
   */
  async open(
    tweetText: string,
    tweetHash: TweetHash,
    aiSaidToxic: boolean,
    metadata: TweetMetadata
  ): Promise<void> {
    if (this.isOpen) {
      return;
    }

    // Get AI reasoning from cache
    const cacheManager = getCacheManager();
    const cacheEntry = await cacheManager.getEntry(tweetHash);
    const aiReasoning = cacheEntry?.reasoning || 'No reasoning available';

    this.isOpen = true;
    this.createModal(tweetText, tweetHash, aiSaidToxic, aiReasoning, metadata);
  }

  /**
   * Closes the feedback modal
   */
  close(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.isOpen = false;
  }

  /**
   * Creates the modal DOM structure
   */
  private createModal(
    tweetText: string,
    tweetHash: TweetHash,
    aiSaidToxic: boolean,
    aiReasoning: string,
    metadata: TweetMetadata
  ): void {
    // Skip in test environment
    if (typeof document === 'undefined') {
      return;
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.setAttribute('data-testid', 'feedback-modal-overlay');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '10000',
    });

    // Create modal content
    const modal = document.createElement('div');
    modal.setAttribute('data-testid', 'feedback-modal');
    Object.assign(modal.style, {
      backgroundColor: 'rgb(255, 255, 255)',
      borderRadius: '16px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '80vh',
      overflow: 'auto',
      boxShadow: '0 0 15px rgba(0, 0, 0, 0.2)',
      padding: '24px',
    });

    // Modal header
    const header = document.createElement('div');
    header.style.marginBottom = '20px';

    const title = document.createElement('h2');
    title.textContent = 'Provide AI Feedback';
    Object.assign(title.style, {
      fontSize: '20px',
      fontWeight: '700',
      margin: '0 0 8px 0',
      color: 'rgb(15, 20, 25)',
    });
    header.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Help improve the AI by correcting its classification';
    Object.assign(subtitle.style, {
      fontSize: '14px',
      color: 'rgb(83, 100, 113)',
      margin: '0',
    });
    header.appendChild(subtitle);
    modal.appendChild(header);

    // Tweet preview section
    const tweetSection = this.createTweetPreview(tweetText, metadata);
    modal.appendChild(tweetSection);

    // AI decision section
    const aiSection = this.createAIDecisionSection(aiSaidToxic, aiReasoning);
    modal.appendChild(aiSection);

    // User feedback form
    const feedbackForm = this.createFeedbackForm(
      tweetText,
      tweetHash,
      aiSaidToxic,
      aiReasoning,
      metadata
    );
    modal.appendChild(feedbackForm);

    // Add modal to overlay
    overlay.appendChild(modal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Append to body
    document.body.appendChild(overlay);
    this.modal = overlay;
  }

  /**
   * Creates the tweet preview section
   */
  private createTweetPreview(tweetText: string, metadata: TweetMetadata): HTMLElement {
    const section = document.createElement('div');
    Object.assign(section.style, {
      marginBottom: '20px',
      padding: '16px',
      backgroundColor: 'rgb(247, 249, 249)',
      borderRadius: '12px',
    });

    const label = document.createElement('div');
    label.textContent = 'Tweet';
    Object.assign(label.style, {
      fontSize: '13px',
      fontWeight: '700',
      color: 'rgb(83, 100, 113)',
      marginBottom: '8px',
    });
    section.appendChild(label);

    const authorInfo = document.createElement('div');
    Object.assign(authorInfo.style, {
      fontSize: '14px',
      color: 'rgb(15, 20, 25)',
      marginBottom: '8px',
    });

    const authorName = document.createElement('span');
    authorName.textContent = metadata.authorDisplayName;
    authorName.style.fontWeight = '700';
    authorInfo.appendChild(authorName);

    const authorHandle = document.createElement('span');
    authorHandle.textContent = ` ${metadata.author}`;
    authorHandle.style.color = 'rgb(83, 100, 113)';
    authorInfo.appendChild(authorHandle);

    section.appendChild(authorInfo);

    const text = document.createElement('div');
    text.textContent = tweetText;
    Object.assign(text.style, {
      fontSize: '15px',
      color: 'rgb(15, 20, 25)',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    });
    section.appendChild(text);

    const link = document.createElement('a');
    link.textContent = 'View on X';
    link.href = metadata.url;
    link.target = '_blank';
    Object.assign(link.style, {
      display: 'inline-block',
      marginTop: '8px',
      fontSize: '13px',
      color: 'rgb(29, 155, 240)',
      textDecoration: 'none',
    });
    link.addEventListener('mouseenter', () => {
      link.style.textDecoration = 'underline';
    });
    link.addEventListener('mouseleave', () => {
      link.style.textDecoration = 'none';
    });
    section.appendChild(link);

    return section;
  }

  /**
   * Creates the AI decision section
   */
  private createAIDecisionSection(aiSaidToxic: boolean, aiReasoning: string): HTMLElement {
    const section = document.createElement('div');
    Object.assign(section.style, {
      marginBottom: '20px',
      padding: '16px',
      backgroundColor: aiSaidToxic ? 'rgb(254, 243, 242)' : 'rgb(240, 255, 244)',
      borderRadius: '12px',
      border: aiSaidToxic ? '1px solid rgb(249, 24, 128)' : '1px solid rgb(0, 186, 124)',
    });

    const label = document.createElement('div');
    label.textContent = 'AI Classification';
    Object.assign(label.style, {
      fontSize: '13px',
      fontWeight: '700',
      color: 'rgb(83, 100, 113)',
      marginBottom: '8px',
    });
    section.appendChild(label);

    const decision = document.createElement('div');
    decision.textContent = aiSaidToxic ? '⚠️ Toxic' : '✅ Not Toxic';
    Object.assign(decision.style, {
      fontSize: '15px',
      fontWeight: '700',
      color: aiSaidToxic ? 'rgb(249, 24, 128)' : 'rgb(0, 186, 124)',
      marginBottom: '12px',
    });
    section.appendChild(decision);

    const reasoningLabel = document.createElement('div');
    reasoningLabel.textContent = 'AI Reasoning:';
    Object.assign(reasoningLabel.style, {
      fontSize: '13px',
      fontWeight: '700',
      color: 'rgb(83, 100, 113)',
      marginBottom: '6px',
    });
    section.appendChild(reasoningLabel);

    const reasoning = document.createElement('div');
    reasoning.textContent = aiReasoning;
    Object.assign(reasoning.style, {
      fontSize: '13px',
      color: 'rgb(15, 20, 25)',
      lineHeight: '1.4',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxHeight: '150px',
      overflow: 'auto',
      padding: '8px',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      borderRadius: '8px',
    });
    section.appendChild(reasoning);

    return section;
  }

  /**
   * Creates the user feedback form
   */
  private createFeedbackForm(
    tweetText: string,
    tweetHash: TweetHash,
    aiSaidToxic: boolean,
    aiReasoning: string,
    metadata: TweetMetadata
  ): HTMLElement {
    const form = document.createElement('form');
    form.setAttribute('data-testid', 'feedback-form');

    // Question
    const question = document.createElement('div');
    question.textContent = 'Do you agree with this classification?';
    Object.assign(question.style, {
      fontSize: '15px',
      fontWeight: '700',
      color: 'rgb(15, 20, 25)',
      marginBottom: '12px',
    });
    form.appendChild(question);

    // Radio buttons
    const radioGroup = document.createElement('div');
    radioGroup.style.marginBottom = '16px';

    const agreeRadio = this.createRadioOption(
      'feedback-agree',
      'agree',
      'Yes, the AI is correct'
    );
    const disagreeRadio = this.createRadioOption(
      'feedback-disagree',
      'disagree',
      'No, the AI is wrong'
    );

    radioGroup.appendChild(agreeRadio.container);
    radioGroup.appendChild(disagreeRadio.container);
    form.appendChild(radioGroup);

    // Explanation textarea
    const explanationLabel = document.createElement('label');
    explanationLabel.textContent = 'Why? (optional)';
    Object.assign(explanationLabel.style, {
      display: 'block',
      fontSize: '13px',
      fontWeight: '700',
      color: 'rgb(83, 100, 113)',
      marginBottom: '6px',
    });
    form.appendChild(explanationLabel);

    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'feedback-explanation');
    textarea.placeholder = 'Explain why you agree or disagree...';
    Object.assign(textarea.style, {
      width: '100%',
      minHeight: '80px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid rgb(207, 217, 222)',
      borderRadius: '8px',
      resize: 'vertical',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    });
    textarea.addEventListener('focus', () => {
      textarea.style.borderColor = 'rgb(29, 155, 240)';
      textarea.style.outline = 'none';
    });
    textarea.addEventListener('blur', () => {
      textarea.style.borderColor = 'rgb(207, 217, 222)';
    });
    form.appendChild(textarea);

    // Buttons
    const buttonContainer = document.createElement('div');
    Object.assign(buttonContainer.style, {
      display: 'flex',
      gap: '12px',
      marginTop: '20px',
      justifyContent: 'flex-end',
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    Object.assign(cancelButton.style, {
      padding: '10px 20px',
      fontSize: '15px',
      fontWeight: '700',
      border: '1px solid rgb(207, 217, 222)',
      borderRadius: '9999px',
      backgroundColor: 'transparent',
      color: 'rgb(15, 20, 25)',
      cursor: 'pointer',
    });
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.backgroundColor = 'rgb(247, 249, 249)';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.backgroundColor = 'transparent';
    });
    cancelButton.addEventListener('click', () => {
      this.close();
    });
    buttonContainer.appendChild(cancelButton);

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Submit Feedback';
    submitButton.setAttribute('data-testid', 'feedback-submit');
    Object.assign(submitButton.style, {
      padding: '10px 20px',
      fontSize: '15px',
      fontWeight: '700',
      border: 'none',
      borderRadius: '9999px',
      backgroundColor: 'rgb(29, 155, 240)',
      color: 'rgb(255, 255, 255)',
      cursor: 'pointer',
    });
    submitButton.addEventListener('mouseenter', () => {
      submitButton.style.backgroundColor = 'rgb(26, 140, 216)';
    });
    submitButton.addEventListener('mouseleave', () => {
      submitButton.style.backgroundColor = 'rgb(29, 155, 240)';
    });
    buttonContainer.appendChild(submitButton);

    form.appendChild(buttonContainer);

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const userAgrees = agreeRadio.input.checked;
      const userDisagrees = disagreeRadio.input.checked;

      if (!userAgrees && !userDisagrees) {
        alert('Please select whether you agree or disagree');
        return;
      }

      const userSaysToxic = userDisagrees ? !aiSaidToxic : aiSaidToxic;
      const userExplanation = textarea.value.trim();

      const feedbackEntry: FeedbackEntry = {
        hash: tweetHash,
        text: tweetText,
        url: metadata.url,
        author: metadata.author,
        authorDisplayName: metadata.authorDisplayName,
        timestamp: Date.now(),
        aiSaidToxic,
        aiReasoning,
        userSaysToxic,
        userExplanation: userExplanation || '(No explanation provided)',
      };

      const feedbackManager = getFeedbackManager();
      await feedbackManager.addFeedback(feedbackEntry);

      console.log('Feedback submitted:', feedbackEntry);
      this.close();
    });

    return form;
  }

  /**
   * Creates a radio button option
   */
  private createRadioOption(
    id: string,
    name: string,
    label: string
  ): { container: HTMLElement; input: HTMLInputElement } {
    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '8px',
    });

    const input = document.createElement('input');
    input.type = 'radio';
    input.id = id;
    input.name = 'feedback';
    input.value = name;
    Object.assign(input.style, {
      width: '20px',
      height: '20px',
      marginRight: '8px',
      cursor: 'pointer',
    });
    container.appendChild(input);

    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    Object.assign(labelElement.style, {
      fontSize: '15px',
      color: 'rgb(15, 20, 25)',
      cursor: 'pointer',
    });
    container.appendChild(labelElement);

    return { container, input };
  }
}

/**
 * Global singleton instance
 */
let globalFeedbackModal: FeedbackModal | null = null;

/**
 * Gets or creates the global FeedbackModal instance
 */
export function getFeedbackModal(): FeedbackModal {
  if (!globalFeedbackModal) {
    globalFeedbackModal = new FeedbackModal();
  }
  return globalFeedbackModal;
}

/**
 * Sets a custom FeedbackModal instance (useful for testing)
 */
export function setFeedbackModal(modal: FeedbackModal): void {
  globalFeedbackModal = modal;
}
