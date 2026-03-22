import { describe, it, expect } from 'vitest';
import { parseDealAction, stripDealAction } from '../parseDealAction';

describe('parseDealAction', () => {
    it('parses a well-formed create-deal tag', () => {
        const content = `I'll create a deal for this contract now.
<create-deal name="Azula TV Loan" description="Loan agreement against Azula TV show"/>
Let me know if you need anything else.`;

        const result = parseDealAction(content);
        expect(result).toEqual({
            name: 'Azula TV Loan',
            description: 'Loan agreement against Azula TV show',
        });
    });

    it('returns null when no tag is present', () => {
        expect(parseDealAction('Just a regular message with no action.')).toBeNull();
    });

    it('returns null when name attribute is missing', () => {
        const content = '<create-deal description="No name here"/>';
        expect(parseDealAction(content)).toBeNull();
    });

    it('handles single-word deal name', () => {
        const result = parseDealAction('<create-deal name="Lemon" description="Lemon fund deal"/>');
        expect(result?.name).toBe('Lemon');
    });

    it('handles missing description gracefully', () => {
        const result = parseDealAction('<create-deal name="Quick Deal"/>');
        expect(result?.name).toBe('Quick Deal');
        expect(result?.description).toBe('');
    });

    it('is case-insensitive on tag name', () => {
        const result = parseDealAction('<Create-Deal name="Test Deal" description="desc"/>');
        expect(result?.name).toBe('Test Deal');
    });
});

describe('stripDealAction', () => {
    it('removes the create-deal tag from content', () => {
        const content = `Creating the deal now.\n<create-deal name="X" description="Y"/>\nDone!`;
        const stripped = stripDealAction(content);
        expect(stripped).not.toContain('<create-deal');
        expect(stripped).toContain('Creating the deal now.');
        expect(stripped).toContain('Done!');
    });

    it('collapses extra blank lines left by removal', () => {
        const content = `Line one.\n\n\n<create-deal name="X" description="Y"/>\n\n\nLine two.`;
        const stripped = stripDealAction(content);
        expect(stripped).not.toMatch(/\n{3,}/);
    });

    it('returns original content unchanged if no tag present', () => {
        const content = 'No tag here.';
        expect(stripDealAction(content)).toBe(content);
    });
});
