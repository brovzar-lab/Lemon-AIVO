/**
 * Parses a <create-deal .../> sentinel tag from agent response content.
 *
 * Agents emit this tag on its own line when the user asks them to create a deal:
 *   <create-deal name="Azula TV Loan" description="Loan against Azula TV show"/>
 *
 * Returns the extracted name and description, or null if no tag is present.
 */
export interface DealAction {
    name: string;
    description: string;
}

export function parseDealAction(content: string): DealAction | null {
    // Match <create-deal ... /> or <create-deal ...></create-deal>
    const tagMatch = content.match(/<create-deal\s([^>]*?)\/?>/i);
    if (!tagMatch) return null;

    const attrs = tagMatch[1] ?? '';

    const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
    const descMatch = attrs.match(/description=["']([^"']+)["']/i);

    const name = nameMatch?.[1]?.trim();
    if (!name) return null;

    return {
        name,
        description: descMatch?.[1]?.trim() ?? '',
    };
}

/**
 * Strips the <create-deal .../> sentinel from visible message text.
 * Used by MessageList to hide the raw tag from the UI.
 */
export function stripDealAction(content: string): string {
    return content.replace(/<create-deal\s[^>]*?\/?>/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}
