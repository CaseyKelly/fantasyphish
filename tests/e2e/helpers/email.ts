import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailData {
  id: string;
  to: string[];
  from: string;
  subject: string;
  html: string;
  text: string | null;
  created_at: string;
  last_event: string;
}

/**
 * Wait for an email to be sent and retrieve it from Resend
 * 
 * @param toEmail - The recipient email address (must be a Resend test email)
 * @param options - Options for waiting and filtering
 * @returns The email data including HTML content
 */
export async function waitForEmail(
  toEmail: string,
  options: {
    subject?: string;
    timeout?: number;
    pollInterval?: number;
  } = {}
): Promise<EmailData> {
  const { subject, timeout = 30000, pollInterval = 2000 } = options; // 2 seconds to respect rate limit
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      // List recent emails
      const { data: emails, error } = await resend.emails.list({
        limit: 20,
      });

      if (error) {
        throw new Error(`Failed to list emails: ${error.message}`);
      }

      if (!emails?.data) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      // Find matching email
      const matchingEmail = emails.data.find((email: any) => {
        const matchesRecipient = email.to?.includes(toEmail);
        const matchesSubject = !subject || email.subject === subject;
        return matchesRecipient && matchesSubject;
      });

      if (matchingEmail) {
        // Add a small delay before fetching full email to avoid hitting rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get full email details including HTML content
        const { data: fullEmail, error: getError } = await resend.emails.get(matchingEmail.id);
        
        if (getError) {
          throw new Error(`Failed to get email: ${getError.message}`);
        }

        return fullEmail as EmailData;
      }
    } catch (error) {
      console.error('Error checking for email:', error);
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `Email not received within ${timeout}ms. Looking for email to: ${toEmail}${subject ? ` with subject: ${subject}` : ''}`
  );
}

/**
 * Extract the verification token from an email HTML
 * 
 * @param emailHtml - The HTML content of the email
 * @returns The verification token
 */
export function extractVerificationToken(emailHtml: string): string {
  // Look for verification URL in href attribute
  const match = emailHtml.match(/\/verify\?token=([a-f0-9]+)/i);
  
  if (!match || !match[1]) {
    throw new Error('Could not find verification token in email HTML');
  }

  return match[1];
}

/**
 * Extract any URL from an email HTML
 * 
 * @param emailHtml - The HTML content of the email
 * @param pattern - Regex pattern to match the URL
 * @returns The matched URL
 */
export function extractUrlFromEmail(emailHtml: string, pattern: RegExp): string {
  const match = emailHtml.match(pattern);
  
  if (!match || !match[0]) {
    throw new Error(`Could not find URL matching pattern ${pattern} in email HTML`);
  }

  return match[0];
}

/**
 * Generate a unique test email using Resend's test email format
 * 
 * @param label - A unique label to identify this test
 * @returns A test email address that will be delivered
 */
export function generateTestEmail(label: string): string {
  const timestamp = Date.now();
  return `delivered+${label}-${timestamp}@resend.dev`;
}

/**
 * Generate a test email that will bounce
 * 
 * @param label - A unique label to identify this test
 * @returns A test email address that will bounce
 */
export function generateBounceTestEmail(label: string): string {
  const timestamp = Date.now();
  return `bounce+${label}-${timestamp}@resend.dev`;
}

/**
 * Generate a test email that will be marked as spam
 * 
 * @param label - A unique label to identify this test
 * @returns A test email address that will be marked as spam
 */
export function generateSpamTestEmail(label: string): string {
  const timestamp = Date.now();
  return `complaint+${label}-${timestamp}@resend.dev`;
}
