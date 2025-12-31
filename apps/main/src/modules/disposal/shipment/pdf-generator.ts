import jsPDF from 'jspdf';

export interface MemorandumData {
  no_ba_pemusnahan: string;
  id_pemusnahan_smile: string;
  nama_fasilitas_kesehatan: string;
  kota: string;
  provinsi: string;
  kegiatan: string;
  materials: Array<{
    no: number;
    tag_entitas: string;
    kategori: string;
    kode_material: string;
    nama_material: string;
    batch: string;
    kuantitas: number;
    alasan_pemusnahan: string;
  }>;
  sender: {
    name: string;
    address: string;
  };
  receiver: {
    name: string;
    address: string;
  };
  created_at: string;
  comments: string;
}

export class PDFGenerator {
  static generateMemorandum(data: MemorandumData): Buffer {
    const doc = new jsPDF();
    
    // Set font
    doc.setFont('helvetica');
    
    // Title
    doc.setFontSize(16);
    doc.text('BERITA ACARA PEMUSNAHAN', 105, 20, { align: 'center' });
    
    // Header Information
    doc.setFontSize(12);
    let yPos = 40;
    
    doc.text(`No BA Pemusnahan: ${data.no_ba_pemusnahan}`, 20, yPos);
    yPos += 10;
    doc.text(`ID Pemusnahan SMILE: ${data.id_pemusnahan_smile}`, 20, yPos);
    yPos += 10;
    doc.text(`Nama Fasilitas Kesehatan: ${data.nama_fasilitas_kesehatan}`, 20, yPos);
    yPos += 10;
    doc.text(`Kota: ${data.kota}`, 20, yPos);
    yPos += 10;
    doc.text(`Provinsi: ${data.provinsi}`, 20, yPos);
    yPos += 10;
    doc.text(`Kegiatan: ${data.kegiatan}`, 20, yPos);
    yPos += 20;
    
    // Sender and Receiver
    doc.setFontSize(10);
    doc.text('PIHAK PERTAMA (PENGIRIM):', 20, yPos);
    doc.text('PIHAK KEDUA (PENERIMA):', 110, yPos);
    yPos += 10;
    
    doc.text(`${data.sender.name}`, 20, yPos);
    doc.text(`${data.receiver.name}`, 110, yPos);
    yPos += 8;
    
    // Wrap address text
    const senderAddress = doc.splitTextToSize(data.sender.address, 80);
    const receiverAddress = doc.splitTextToSize(data.receiver.address, 80);
    
    doc.text(senderAddress, 20, yPos);
    doc.text(receiverAddress, 110, yPos);
    yPos += Math.max(senderAddress.length, receiverAddress.length) * 5 + 10;
    
    // Materials Table Header
    doc.setFontSize(10);
    doc.text('DAFTAR MATERIAL YANG DIMUSNAHKAN:', 20, yPos);
    yPos += 10;
    
    // Table headers
    const headers = ['No', 'Nama Material', 'Batch', 'Qty', 'Alasan'];
    const colWidths = [15, 80, 30, 20, 40];
    let xPos = 20;
    
    doc.setFontSize(8);
    headers.forEach((header, index) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[index];
    });
    yPos += 8;
    
    // Draw line under headers
    doc.line(20, yPos - 2, 185, yPos - 2);
    
    // Materials data
    data.materials.forEach((material) => {
      if (yPos > 250) { // Check if we need a new page
        doc.addPage();
        yPos = 20;
      }
      
      xPos = 20;
      const rowData = [
        material.no.toString(),
        material.nama_material.substring(0, 25) + (material.nama_material.length > 25 ? '...' : ''),
        material.batch,
        material.kuantitas.toString(),
        material.alasan_pemusnahan.substring(0, 15) + (material.alasan_pemusnahan.length > 15 ? '...' : '')
      ];
      
      rowData.forEach((data, index) => {
        doc.text(data, xPos, yPos);
        xPos += colWidths[index];
      });
      yPos += 8;
    });
    
    yPos += 20;
    
    // Comments
    if (data.comments) {
      doc.setFontSize(10);
      doc.text('KETERANGAN:', 20, yPos);
      yPos += 10;
      
      const commentLines = doc.splitTextToSize(data.comments, 160);
      doc.setFontSize(9);
      doc.text(commentLines, 20, yPos);
      yPos += commentLines.length * 5 + 20;
    }
    
    // Signature section
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(10);
    doc.text('PIHAK PERTAMA', 30, yPos);
    doc.text('PIHAK KEDUA', 130, yPos);
    yPos += 40;
    
    doc.text('(_____________________)', 20, yPos);
    doc.text('(_____________________)', 120, yPos);
    yPos += 10;
    
    doc.text('Nama & Tanda Tangan', 25, yPos);
    doc.text('Nama & Tanda Tangan', 125, yPos);
    
    // Footer
    doc.setFontSize(8);
    doc.text(`Dibuat pada: ${new Date(data.created_at).toLocaleDateString('id-ID')}`, 20, 280);
    
    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return pdfBuffer;
  }
}
