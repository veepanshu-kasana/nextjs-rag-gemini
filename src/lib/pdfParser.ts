import PDFParser from 'pdf2json';

interface PDFText {
  R: Array<{ T: string }>;
}

interface PDFPage {
  Texts: PDFText[];
}

interface PDFData {
  Pages: PDFPage[];
}

/**
 * Parses a PDF file buffer and extracts raw text content.
 * @param buffer - PDF file buffer
 * @returns Promise resolving to extracted text string
 * @throws Error if PDF parsing fails
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
      const message = errData instanceof Error ? errData.message : errData.parserError.message;
      reject(new Error(`Failed to parse PDF: ${message}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: PDFData) => {
      try {
        const textParts: string[] = [];
        
        pdfData.Pages.forEach((page) => {
          page.Texts.forEach((text) => {
            text.R.forEach((r) => {
              try {
                const decodedText = decodeURIComponent(r.T);
                if (decodedText.trim()) {
                  textParts.push(decodedText);
                }
              } catch {
                // If decoding fails, use the raw text
                if (r.T && r.T.trim()) {
                  textParts.push(r.T);
                }
              }
            });
          });
        });

        const extractedText = textParts.join(' ').trim();
        resolve(extractedText || '');
      } catch (error) {
        reject(new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}