import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const { name, email, company, planInterest } = body;
    if (!name || !email || !company || !planInterest) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    // Read existing submissions or create new file
    const filePath = path.join(dataDir, 'early-signups.json');
    let submissions = [];

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      submissions = JSON.parse(fileContent);
    } catch (err) {
      // File doesn't exist yet, start with empty array
    }

    // Add new submission
    submissions.push({
      ...body,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    });

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(submissions, null, 2));

    return NextResponse.json(
      { message: 'Submission successful', id: submissions[submissions.length - 1].id },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing early access submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
