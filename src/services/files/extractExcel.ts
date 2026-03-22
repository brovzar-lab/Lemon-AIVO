import { read, utils } from 'xlsx';

/**
 * Converts an Excel workbook (ArrayBuffer) into a markdown string.
 *
 * Each sheet is rendered as:
 *   ## Sheet: <SheetName>
 *   | col1 | col2 | ...
 *   |------|------|...
 *   | val  | val  | ...
 *
 * Empty cells are rendered as empty strings. Numeric values are kept as-is
 * so accounting figures (amounts, dates stored as numbers) are preserved.
 */
export function extractExcelText(data: ArrayBuffer): string {
    const workbook = read(data, { type: 'array', cellDates: true });
    const sections: string[] = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Convert sheet to array-of-arrays (rows × cols), raw values preserved
        const rows: unknown[][] = utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false, // format dates/numbers as strings for readability
        });

        if (rows.length === 0) continue;

        const lines: string[] = [`## Sheet: ${sheetName}`, ''];

        // Build markdown table
        rows.forEach((row, rowIdx) => {
            const cells = (row as string[]).map((cell) =>
                String(cell ?? '').replace(/\|/g, '\\|').trim()
            );
            lines.push(`| ${cells.join(' | ')} |`);

            // Add separator after header row
            if (rowIdx === 0) {
                lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
            }
        });

        sections.push(lines.join('\n'));
    }

    return sections.join('\n\n');
}
