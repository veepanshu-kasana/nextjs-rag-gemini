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

export interface PageText {
  pageNumber: number;
  text: string;
}

/**
 * Parses a PDF file buffer and extracts text content with page numbers.
 * @param buffer - PDF file buffer
 * @returns Promise resolving to array of page texts with page numbers
 * @throws Error if PDF parsing fails
 */
export async function parsePDFWithPages(buffer: Buffer): Promise<PageText[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
      const message = errData instanceof Error ? errData.message : errData.parserError.message;
      reject(new Error(`Failed to parse PDF: ${message}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: PDFData) => {
      try {
        const pages: PageText[] = [];
        
        pdfData.Pages.forEach((page, pageIndex) => {
          const textParts: string[] = [];
          
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

          const pageText = textParts.join(' ').trim();
          
          // Only add page if it has content
          if (pageText) {
            pages.push({
              pageNumber: pageIndex + 1, // 1-based page numbers
              text: pageText,
            });
          }
        });

        resolve(pages);
      } catch (error) {
        reject(new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Parses a PDF file buffer and extracts raw text content.
 * @param buffer - PDF file buffer
 * @returns Promise resolving to extracted text string
 * @throws Error if PDF parsing fails
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  const pages = await parsePDFWithPages(buffer);
  return pages.map(p => p.text).join(' ');
}