import { logError } from '@/lib/error-handler';
import { ERROR_MESSAGES } from '@/lib/types/error-messages';
import { STATUS_CODES } from '@/lib/types/status-codes';
import { NextRequest, NextResponse } from 'next/server';

/**
 * @ai-context API endpoint for processing already parsed CSV data
 * @ai-purpose Receives processed CSV data from frontend and validates/transforms it
 * @ai-data-expects JSON with array of SAP project data objects
 * @ai-business-context Validation and processing of SAP planning data
 * @ai-special-cases Handles different data formats and corporate validations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data } = body;

    // Validate input data structure
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format. Expected array of objects.' },
        { status: STATUS_CODES.BAD_REQUEST }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data provided.' },
        { status: STATUS_CODES.BAD_REQUEST }
      );
    }

    // Validate SAP project data structure
    const validateSAPProjectData = (data: any[]): void => {
      const requiredColumns = ['plannedAbapDevStart', 'plannedAbapDevEnd', 'abapAssigned', 'abapDevelopmentTime'];
      const firstRow = data[0];
      
      if (!firstRow || typeof firstRow !== 'object') {
        throw new Error('Invalid data structure. Expected object with project data.');
      }

      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }
    };

    validateSAPProjectData(data);

    // Simple data processing - normalize dates and numbers
    const processSAPProjectData = (data: any[]): any[] => {
      return data.map(row => {
        const processedRow = { ...row };

        // Normalize date columns
        const dateColumns = ['plannedAbapDevStart', 'plannedAbapDevEnd'];
        dateColumns.forEach(col => {
          if (row[col]) {
            try {
              const date = new Date(row[col] as string);
              if (!isNaN(date.getTime())) {
                processedRow[col] = date.toISOString();
              }
            } catch {
              // Keep original value if date parsing fails
            }
          }
        });

        // Normalize numeric columns
        const numericColumns = ['abapDevelopmentTime'];
        numericColumns.forEach(col => {
          if (row[col]) {
            const num = parseFloat(row[col] as string);
            if (!isNaN(num)) {
              processedRow[col] = num;
            }
          }
        });

        return processedRow;
      });
    };

    const processedData = processSAPProjectData(data);

    // Return processed data
    return NextResponse.json({
      success: true,
      data: processedData,
      message: `Successfully processed ${processedData.length} SAP project records`
    });

  } catch (error) {
    logError(
      {
        type: 'processing',
        message: 'Failed to process parsed CSV data',
        details: error,
        timestamp: Date.now(),
        userFriendly: true,
      },
      'upload-parsed'
    );

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_SERVER_ERROR 
      },
      { status: STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
} 