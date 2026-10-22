import * as XLSX from 'xlsx';

/**
 * Universal Excel Export Utility for Canteen System Reports
 * Supports multiple sheets, RTL Arabic layout, and automated column width sizing.
 */
export const exportToExcel = ({ filename, sheets }) => {
  try {
    const wb = XLSX.utils.book_new();

    sheets.forEach(sheet => {
      let ws;
      if (Array.isArray(sheet.data) && sheet.data.length > 0 && Array.isArray(sheet.data[0])) {
        // Array of Arrays
        ws = XLSX.utils.aoa_to_sheet(sheet.data);
      } else {
        // Array of Objects
        ws = XLSX.utils.json_to_sheet(sheet.data || []);
      }

      // Configure RTL layout for Excel
      if (!ws['!views']) ws['!views'] = [];
      ws['!views'].push({ RTL: true });

      // Calculate auto column widths
      if (sheet.columns) {
        ws['!cols'] = sheet.columns;
      } else if (Array.isArray(sheet.data) && sheet.data.length > 0) {
        if (Array.isArray(sheet.data[0])) {
          // AOA format
          const colWidths = [];
          sheet.data.forEach(row => {
            row.forEach((cell, colIdx) => {
              const strVal = cell !== null && cell !== undefined ? String(cell) : '';
              colWidths[colIdx] = Math.max(colWidths[colIdx] || 12, strVal.length + 4);
            });
          });
          ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 45) }));
        } else {
          // JSON format
          const sample = sheet.data[0];
          const keys = Object.keys(sample);
          const colWidths = keys.map(key => {
            let maxLen = key.length;
            for (let i = 0; i < Math.min(sheet.data.length, 50); i++) {
              const val = sheet.data[i][key];
              if (val !== null && val !== undefined) {
                maxLen = Math.max(maxLen, String(val).length);
              }
            }
            return { wch: Math.min(Math.max(maxLen + 4, 14), 45) };
          });
          ws['!cols'] = colWidths;
        }
      }

      const safeSheetName = (sheet.name || 'تقرير').replace(/[:\\/?*[\]]/g, '').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    });

    const cleanFilename = `${filename.replace(/\.xlsx$/i, '')}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
    return true;
  } catch (err) {
    console.error('[Excel Export Error]:', err);
    throw err;
  }
};

/**
 * Format date for Excel filenames
 */
export const getReportFilenameDate = (date = new Date()) => {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
