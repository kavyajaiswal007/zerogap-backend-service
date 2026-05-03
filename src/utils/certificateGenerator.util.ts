import PDFDocument from 'pdfkit';

export interface CertificatePdfData {
  userName: string;
  playlistTitle: string;
  score: number;
  watchSeconds: number;
  code: string;
  issuedAt: Date;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatHours(seconds: number) {
  return `${Math.max(0.1, seconds / 3600).toFixed(1)}h`;
}

export function generateCertificatePDF(data: CertificatePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      info: {
        Title: `ZeroGap Certificate - ${data.playlistTitle}`,
        Author: 'ZeroGap',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const width = doc.page.width;
    const height = doc.page.height;

    doc.rect(0, 0, width, height).fill('#0f172a');
    doc.rect(26, 26, width - 52, height - 52).lineWidth(7).stroke('#f59e0b');
    doc.rect(44, 44, width - 88, height - 88).lineWidth(2).stroke('#38bdf8');

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(34)
      .text('ZeroGap', 0, 72, { align: 'center' });

    doc
      .fillColor('#f59e0b')
      .font('Helvetica-Bold')
      .fontSize(24)
      .text('Certificate of Completion', 0, 128, { align: 'center' });

    doc
      .fillColor('#cbd5e1')
      .font('Helvetica')
      .fontSize(13)
      .text('This certifies that', 0, 184, { align: 'center' });

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(40)
      .text(data.userName || 'ZeroGap Learner', 70, 213, { align: 'center', width: width - 140 });

    doc
      .fillColor('#cbd5e1')
      .font('Helvetica')
      .fontSize(13)
      .text('has successfully completed', 0, 284, { align: 'center' });

    doc
      .fillColor('#f59e0b')
      .font('Helvetica-Bold')
      .fontSize(25)
      .text(data.playlistTitle, 86, 312, { align: 'center', width: width - 172 });

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(`Quiz Average: ${Math.round(data.score)}%`, 0, 382, { align: 'center' })
      .text(`Watch Time: ${formatHours(data.watchSeconds)}`, 0, 410, { align: 'center' });

    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(11)
      .text(`Issued: ${formatDate(data.issuedAt)}`, 78, height - 108)
      .text(`Certificate Code: ${data.code}`, 0, height - 108, { align: 'center' })
      .text(`Verify at zerogap.io/verify/${data.code}`, 0, height - 82, { align: 'center' });

    doc
      .fillColor('#38bdf8')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('WATCHED · QUIZZED · CERTIFIED', width - 238, height - 108, { width: 160, align: 'right' });

    doc.end();
  });
}
