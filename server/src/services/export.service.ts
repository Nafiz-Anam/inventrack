import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Response } from 'express';

/**
 * Export user data to PDF
 * @param {Array} users - Array of user objects
 * @param {Response} res - Express response object
 */
export const exportUsersToPDF = async (users: any[], res: Response) => {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(20);
  doc.text('Users Report', 14, 20);

  // Add timestamp
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Total Users: ${users.length}`, 14, 40);

  // Add table headers
  doc.setFontSize(12);
  const headers = ['Name', 'Email', 'Phone', 'Country', 'State', 'City', 'Role', 'Status'];
  let yPosition = 50;

  headers.forEach((header, index) => {
    doc.text(header, 14 + index * 25, yPosition);
  });

  // Add user data
  doc.setFontSize(10);
  yPosition += 10;

  users.forEach(user => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    const rowData = [
      user.name || 'N/A',
      user.email || 'N/A',
      user.phone || 'N/A',
      user.country || 'N/A',
      user.state || 'N/A',
      user.city || 'N/A',
      user.role || 'N/A',
      user.isActive ? 'Active' : 'Inactive',
    ];

    rowData.forEach((data, colIndex) => {
      doc.text(String(data), 14 + colIndex * 25, yPosition);
    });

    yPosition += 8;
  });

  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=users-${Date.now()}.pdf`);

  // Send PDF
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  res.send(pdfBuffer);
};

/**
 * Export user data to Excel
 * @param {Array} users - Array of user objects
 * @param {Response} res - Express response object
 */
export const exportUsersToExcel = async (users: any[], res: Response) => {
  // Prepare data for Excel
  const excelData = users.map(user => ({
    Name: user.name || 'N/A',
    Email: user.email || 'N/A',
    Phone: user.phone || 'N/A',
    PhoneCode: user.phoneCode || 'N/A',
    Country: user.country || 'N/A',
    State: user.state || 'N/A',
    City: user.city || 'N/A',
    Address: user.address || 'N/A',
    ProfilePicture: user.profilePicture || 'N/A',
    DateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'N/A',
    Gender: user.gender || 'N/A',
    Role: user.role || 'N/A',
    IsEmailVerified: user.isEmailVerified ? 'Yes' : 'No',
    IsActive: user.isActive ? 'Active' : 'Inactive',
    IsLocked: user.isLocked ? 'Yes' : 'No',
    TwoFactorEnabled: user.twoFactorEnabled ? 'Yes' : 'No',
    LastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never',
    CreatedAt: user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A',
    UpdatedAt: user.updatedAt ? new Date(user.updatedAt).toLocaleString() : 'N/A',
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Users');

  // Generate buffer
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

  // Set response headers
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename=users-${Date.now()}.xlsx`);

  // Send Excel file
  res.send(excelBuffer);
};

/**
 * Generate CSV data for users
 * @param {Array} users - Array of user objects
 * @returns {string} CSV string
 */
export const generateUsersCSV = (users: any[]): string => {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'PhoneCode',
    'Country',
    'State',
    'City',
    'Address',
    'ProfilePicture',
    'DateOfBirth',
    'Gender',
    'Role',
    'IsEmailVerified',
    'IsActive',
    'IsLocked',
    'TwoFactorEnabled',
    'LastLoginAt',
    'CreatedAt',
    'UpdatedAt',
  ];

  const csvRows = [headers.join(',')];

  users.forEach(user => {
    const row = [
      `"${(user.name || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.email || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.phone || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.phoneCode || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.country || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.state || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.city || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.address || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.profilePicture || 'N/A').replace(/"/g, '""')}"`,
      `"${user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'N/A'}"`,
      `"${(user.gender || 'N/A').replace(/"/g, '""')}"`,
      `"${(user.role || 'N/A').replace(/"/g, '""')}"`,
      `"${user.isEmailVerified ? 'Yes' : 'No'}"`,
      `"${user.isActive ? 'Active' : 'Inactive'}"`,
      `"${user.isLocked ? 'Yes' : 'No'}"`,
      `"${user.twoFactorEnabled ? 'Yes' : 'No'}"`,
      `"${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}"`,
      `"${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}"`,
      `"${user.updatedAt ? new Date(user.updatedAt).toLocaleString() : 'N/A'}"`,
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
};

export default {
  exportUsersToPDF,
  exportUsersToExcel,
  generateUsersCSV,
};
