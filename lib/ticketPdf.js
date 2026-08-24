const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const TYPE_LABELS = {
  anticipada: 'ENTRADA ANTICIPADA',
  puerta: 'ENTRADA EN PUERTA',
  cortesia: 'ENTRADA DE CORTESIA'
};

function formatMoney(value) {
  return '$ ' + Number(value || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function resolveLogoPath(logoPath) {
  if (!logoPath) return null;
  const publicDir = path.resolve(__dirname, '..', 'public');
  const candidate = path.resolve(publicDir, String(logoPath).replace(/^[/\\]+/, ''));
  if (!candidate.startsWith(publicDir + path.sep) || !fs.existsSync(candidate)) return null;
  return candidate;
}

function safeText(value, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function ticketValueLabel(ticket) {
  return ticket?.ticket_type === 'cortesia'
    ? 'CORTESIA - SIN CARGO'
    : formatMoney(ticket?.price_paid);
}

async function buildTicketPdf(tickets, settings = {}) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    throw new Error('No hay entradas para generar el PDF');
  }

  const qrImages = await Promise.all(tickets.map(ticket => {
    if (!ticket.qr_token) return null;
    return QRCode.toBuffer(`PENA_TICKET:${ticket.qr_token}`, {
      type: 'png',
      width: 620,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#FFFFFF' }
    });
  }));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      size: 'A6',
      layout: 'landscape',
      margin: 0,
      info: {
        Title: `Entradas - ${safeText(settings.company_name, 'Pena')}`,
        Author: safeText(settings.company_name, 'Pena')
      }
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const logoPath = resolveLogoPath(settings.logo_path);
    tickets.forEach((ticket, index) => {
      doc.addPage();
      const width = doc.page.width;
      const height = doc.page.height;

      doc.rect(0, 0, width, height).fill('#FFF7ED');
      doc.roundedRect(12, 12, width - 24, height - 24, 12).fillAndStroke('#FFFFFF', '#FDBA74');
      doc.rect(12, 12, 15, height - 24).fill('#F97316');

      if (logoPath) {
        try {
          doc.image(logoPath, 42, 28, { fit: [52, 42], align: 'left', valign: 'center' });
        } catch (_) {
          // Un logo dañado no debe impedir emitir la entrada.
        }
      }

      const headerX = logoPath ? 104 : 42;
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(16)
        .text(safeText(settings.company_name, 'Mi Pena'), headerX, 27, { width: 168, ellipsis: true });
      doc.fillColor('#EA580C').fontSize(9)
        .text(TYPE_LABELS[ticket.ticket_type] || 'ENTRADA', headerX, 49, { width: 168 });

      const details = [
        settings.cuit ? `CUIT: ${settings.cuit}` : '',
        settings.address,
        settings.phone ? `Tel: ${settings.phone}` : '',
        settings.email
      ].filter(Boolean).join('  |  ');
      doc.fillColor('#6B7280').font('Helvetica').fontSize(6.8)
        .text(details, 42, 73, { width: 230, height: 18, ellipsis: true });

      doc.moveTo(42, 98).lineTo(272, 98).strokeColor('#FED7AA').lineWidth(1).stroke();
      doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(7).text('TITULAR', 42, 110);
      doc.fillColor('#111827').fontSize(13)
        .text(`${safeText(ticket.first_name)} ${safeText(ticket.last_name)}`, 42, 122, { width: 230, ellipsis: true });
      doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
        .text(`DNI: ${safeText(ticket.dni)}`, 42, 143);
      doc.text(`Entrada N° ${String(ticket.id).padStart(6, '0')}`, 42, 158);
      doc.text(`Emitida: ${new Date(ticket.sold_at || Date.now()).toLocaleString('es-AR')}`, 42, 173);

      doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(7)
        .text(ticket.ticket_type === 'cortesia' ? 'CONDICION' : 'VALOR', 42, 198);
      doc.fillColor(ticket.ticket_type === 'cortesia' ? '#7C3AED' : '#111827')
        .fontSize(ticket.ticket_type === 'cortesia' ? 12 : 14)
        .text(ticketValueLabel(ticket), 42, 210, { width: 230 });
      doc.fillColor('#9CA3AF').font('Helvetica').fontSize(6.5)
        .text('Personal e intransferible. Presentar este codigo al ingresar.', 42, 239, { width: 230 });

      const qr = qrImages[index];
      if (qr) {
        doc.roundedRect(287, 28, 110, 171, 10).fillAndStroke('#FFF7ED', '#FED7AA');
        doc.image(qr, 298, 39, { width: 88, height: 88 });
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8)
          .text('QR DE INGRESO', 292, 141, { width: 100, align: 'center' });
        doc.fillColor('#6B7280').font('Helvetica').fontSize(6.5)
          .text('Valido para un solo ingreso', 292, 157, { width: 100, align: 'center' });
      }

      doc.fillColor('#EA580C').font('Helvetica-Bold').fontSize(8)
        .text(`${index + 1} / ${tickets.length}`, 342, 241, { width: 45, align: 'right' });
    });

    doc.end();
  });
}

module.exports = { buildTicketPdf, formatMoney, ticketValueLabel };
